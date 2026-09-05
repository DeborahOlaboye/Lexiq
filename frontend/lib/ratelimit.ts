import "server-only";
import { parseEther, formatEther } from "viem";
import { getRedis } from "./redis";
import { publicClient, relayerAccount } from "./attestation";

/**
 * Limits on the rounds we pay for.
 *
 * Every relayed round costs the relayer about 0.04 CELO (startRoundFor ~124k gas, submitRound
 * ~59k, measured on mainnet). /api/round/start spends that immediately, and its only identity
 * is a guestId the browser makes up, so without a limit a short script drains the relayer in
 * about a minute. MiniPay players are unaffected either way: they pay their own fees.
 *
 * The per-player limits are deliberately loose. A real player cannot finish more than about
 * twenty rounds an hour, so these should never be felt by someone actually playing — the point
 * is to stop a loop, not to ration the game. The two backstops below are what actually make
 * draining impossible, which is why the per-IP limit can stay generous: a lot of MiniPay
 * traffic arrives through carrier-grade NAT, where many genuine players share one address.
 */

export type Limit = { windowSeconds: number; max: number };

const HOUR = 3600;
const DAY = 86400;

export const LIMITS = {
  guestHourly:  { windowSeconds: HOUR, max: 15 } as Limit,
  guestDaily:   { windowSeconds: DAY,  max: 50 } as Limit,
  playerHourly: { windowSeconds: HOUR, max: 30 } as Limit,
  playerDaily:  { windowSeconds: DAY,  max: 100 } as Limit,
  /** Per-IP, across identities: catches one host cycling through fresh guestIds. */
  ipHourly:     { windowSeconds: HOUR, max: 40 } as Limit,
  /** Seed signing costs us nothing on-chain, so this only stops signature farming. */
  seedHourly:   { windowSeconds: HOUR, max: 60 } as Limit,
};

/**
 * What the relayer will still pay for, as a function of what it holds.
 *
 * There is deliberately no daily quota. A fixed "N rounds a day" ceiling caps growth at a
 * number picked in advance, and when it binds it stops everyone at once — an outage caused by
 * the game doing well, which is the wrong way to fail. These thresholds scale with funding
 * instead: topping up the relayer restores service by itself, with nothing to re-tune.
 *
 * Guests are cut before signed-in players. A guestId is free to mint, so guests are both the
 * cheapest abuse vector and the least valuable traffic; signed-in players are scarce, ranked,
 * and the ones a prize week depends on. Cutting the anonymous tier first keeps the game up for
 * everyone who matters and turns the squeeze into a reason to sign in.
 */
const GUEST_FLOOR_CELO = process.env.RELAY_GUEST_MIN_CELO ?? "2";
const MIN_RELAYER_CELO = process.env.RELAY_MIN_CELO ?? "0.5";

/**
 * Fixed window via INCR/EXPIRE. Approximate at the window edges — a burst can straddle two
 * windows — which is the right trade here: these exist to stop a sustained loop, not to ration
 * the game.
 */
export async function hit(key: string, limit: Limit): Promise<{ ok: boolean; retryAfter: number }> {
  const kv = getRedis();
  // Fail open. Redis being down should degrade the game, not close it; the balance floor is
  // the guarantee that does not depend on Redis.
  if (!kv) return { ok: true, retryAfter: 0 };

  const bucket = Math.floor(Date.now() / 1000 / limit.windowSeconds);
  const resetsAt = (bucket + 1) * limit.windowSeconds;
  const k = `lx:rl:${key}:${bucket}`;
  try {
    // EXPIREAT the bucket's own boundary, in one round trip with the INCR. Setting the TTL
    // only alongside the first hit risks leaving the key with no TTL at all if that second
    // command never lands, which would block the identity for good; expiring at an absolute
    // time is idempotent, so repeating it every hit costs nothing and cannot slide the window.
    const res = await kv.multi().incr(k).expireat(k, resetsAt).exec();
    const n = Number(res?.[0]?.[1] ?? 0);
    if (n > limit.max) {
      return { ok: false, retryAfter: Math.max(1, resetsAt - Math.floor(Date.now() / 1000)) };
    }
    return { ok: true, retryAfter: 0 };
  } catch (e) {
    console.error("[ratelimit]", (e as Error).message);
    return { ok: true, retryAfter: 0 };
  }
}

/** The client's address as Caddy saw it. Spoofable end-to-end, so it is a backstop, not proof. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/** healthy: relay for anyone. guests-paused: signed-in only. paused: settle in-flight only. */
export type RelayHealth = "healthy" | "guests-paused" | "paused";

let balanceCheckedAt = 0;
let health: RelayHealth = "healthy";

/**
 * How much of the game we can still afford to pay for.
 *
 * The one check that holds when Redis is unavailable, and the only hard guarantee here: the
 * relayer keeps a float rather than silently reaching zero, which would otherwise surface as
 * rounds failing for everyone with no obvious cause. Cached for a minute so a round does not
 * wait on an RPC call it almost always already knows the answer to.
 */
export async function relayHealth(): Promise<RelayHealth> {
  if (Date.now() - balanceCheckedAt < 60_000) return health;
  try {
    const balance = await publicClient.getBalance({ address: relayerAccount().address });
    const before = health;
    health = balance < parseEther(MIN_RELAYER_CELO) ? "paused"
      : balance < parseEther(GUEST_FLOOR_CELO) ? "guests-paused"
      : "healthy";
    balanceCheckedAt = Date.now();
    if (health !== before) {
      console.error(`[relayer] ${formatEther(balance)} CELO — ${health} (was ${before})`);
    }
  } catch (e) {
    // An RPC blip should not stop play; the next call re-checks.
    console.error("[relayer] balance check failed", (e as Error).message);
  }
  return health;
}

export type Denial = { error: string; status: number; retryAfter?: number };

/**
 * Everything that has to be true before we spend gas on someone's round.
 *
 * Guests are held tighter than signed-in players because a guestId costs nothing to mint,
 * while a Privy wallet needs a real login. A guest who hits the limit is asked to sign in
 * rather than told to go away — the limit and the sign-in prompt want the same thing.
 */
export async function checkRelayBudget(opts: {
  req: Request;
  player: string;
  isGuest: boolean;
}): Promise<Denial | null> {
  const state = await relayHealth();
  if (state === "paused") {
    return { error: "Free rounds are paused right now. Please try again later.", status: 503 };
  }
  if (state === "guests-paused" && opts.isGuest) {
    return { error: "Guest rounds are paused right now. Sign in to keep playing.", status: 503 };
  }

  const id = opts.player.toLowerCase();
  const ip = clientIp(opts.req);

  const checks: Array<[string, Limit]> = opts.isGuest
    ? [[`g:h:${id}`, LIMITS.guestHourly], [`g:d:${id}`, LIMITS.guestDaily], [`ip:${ip}`, LIMITS.ipHourly]]
    : [[`p:h:${id}`, LIMITS.playerHourly], [`p:d:${id}`, LIMITS.playerDaily]];

  for (const [key, limit] of checks) {
    const { ok, retryAfter } = await hit(key, limit);
    if (!ok) {
      return {
        error: opts.isGuest
          ? "That is a lot of rounds. Sign in to keep playing — signed-in players get more."
          : "You have played a lot of rounds recently. Take a break and come back soon.",
        status: 429,
        retryAfter,
      };
    }
  }

  // Counted, never enforced. Knowing the day's burn rate is worth having; refusing a round
  // because of it is not, since the balance thresholds above already bound the spend and do it
  // without stopping the whole game at a number chosen months earlier.
  const kv = getRedis();
  if (kv) {
    try {
      const day = Math.floor(Date.now() / 1000 / DAY);
      const key = `lx:relay:spent:${day}`;
      await kv.multi().incr(key).expireat(key, (day + 1) * DAY + DAY * 7).exec();
    } catch { /* observability only — never blocks a round */ }
  }
  return null;
}

/** Rounds relayed today, for the health endpoint. */
export async function relayedToday(): Promise<number> {
  const kv = getRedis();
  if (!kv) return 0;
  try {
    return Number(await kv.get(`lx:relay:spent:${Math.floor(Date.now() / 1000 / DAY)}`) ?? 0);
  } catch { return 0; }
}

/** Turns a denial into the response, carrying Retry-After so a client can back off properly. */
export function denied(d: Denial): Response {
  return new Response(JSON.stringify({ error: d.error }), {
    status: d.status,
    headers: {
      "Content-Type": "application/json",
      ...(d.retryAfter ? { "Retry-After": String(d.retryAfter) } : {}),
    },
  });
}
