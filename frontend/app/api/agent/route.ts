import { NextResponse } from "next/server";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ROUND, ROUND_FINISHED, LANG_BY_ID } from "@/lib/contracts";
import { publicClient } from "@/lib/attestation";
import { getRedis } from "@/lib/redis";
import { opponentPlay } from "@/lib/opponent";
import type { Lang } from "@/lib/guestLetters";

/**
 * The opponent agent's record, recomputed rather than claimed.
 *
 * ERC-8004's reputation registry refuses feedback from an agent's own owner, which is correct:
 * a score you write about yourself says nothing. So this does not assert a reputation. Every
 * round stores its seed, its letters and the player's settled score, and the agent's play is a
 * pure function of those — so anyone holding this repository and an RPC endpoint can recompute
 * every result and check this page is telling the truth. A derived record cannot be inflated.
 *
 * Counted incrementally: the totals and a watermark are kept in Redis, and each request only
 * examines rounds past it. Rescanning every round on every request would work today and stop
 * working somewhere in the low thousands.
 */

const STATE_KEY = "lx:agent:record";
/** Rounds opened and never played would hold the watermark back for ever. */
const ABANDON_SECONDS = 60 * 60 * 24;

type Record_ = { wins: number; losses: number; draws: number; watermark: number };

const EMPTY: Record_ = { wins: 0, losses: 0, draws: 0, watermark: 0 };

/** In-process cache so a burst of viewers does not each walk the chain. */
let cache: { at: number; body: unknown } | null = null;
const CACHE_MS = 30_000;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) return NextResponse.json(cache.body);

  try {
    const kv = getRedis();
    const stored = kv ? await kv.get(STATE_KEY) : null;
    const rec: Record_ = stored ? { ...EMPTY, ...JSON.parse(stored) } : { ...EMPTY };

    const total = Number(await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "totalRounds",
    }));

    const now = Math.floor(Date.now() / 1000);
    let watermark = rec.watermark;

    for (let id = rec.watermark + 1; id <= total; id++) {
      const r = await publicClient.readContract({
        address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getRound", args: [BigInt(id)],
      }) as readonly unknown[];

      const startedAt = Number(r[ROUND.startedAt]);
      const settled = Number(r[ROUND.state]) === ROUND_FINISHED;

      // A round still in play must be looked at again next time, so the watermark stops here.
      if (!settled) {
        if (startedAt === 0 || now - startedAt < ABANDON_SECONDS) break;
        watermark = id;   // old enough that it is never going to settle
        continue;
      }

      const letters = (await publicClient.readContract({
        address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getLetters", args: [BigInt(id)],
      }) as readonly `0x${string}`[])
        .map((b) => String.fromCharCode(parseInt(b.slice(2), 16))).join("");

      const lang: Lang = LANG_BY_ID[Number(r[ROUND.lang])] ?? "en";
      const human = Number(r[ROUND.score]);
      const agent = opponentPlay({
        seed: String(r[ROUND.seed]), letters, lang, level: Number(r[ROUND.difficulty]),
      });

      if (agent.score > human) rec.wins++;
      else if (agent.score < human) rec.losses++;
      else rec.draws++;
      watermark = id;
    }

    rec.watermark = watermark;
    if (kv) await kv.set(STATE_KEY, JSON.stringify(rec));

    const played = rec.wins + rec.losses + rec.draws;
    const body = {
      agentId: 9835,
      name: "LexIQ Opponent",
      registry: "https://8004scan.io/agents/celo/9835",
      played,
      wins: rec.wins,
      losses: rec.losses,
      draws: rec.draws,
      winRate: played > 0 ? Math.round((rec.wins / played) * 100) : 0,
      // Says plainly that this is derived, so nobody has to take it on trust.
      verifiable: "Recomputed from each round's on-chain seed; the agent's play is deterministic.",
    };

    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[agent]", err);
    return NextResponse.json({ error: "Could not read the agent's record" }, { status: 500 });
  }
}
