import "server-only";
import { getRedis } from "./redis";

/**
 * The daily challenge: everyone plays on the same day, under the same settings, but on their
 * own board.
 *
 * Deliberately not one shared board. A shared set of letters is a shared answer key — the
 * letters are public on-chain the moment the first player opens the round, leaving a whole day
 * for everyone else to read and pre-solve them. With money on the game that would make the
 * stake risk-free and the ranking meaningless. Separate boards keep both honest.
 *
 * Comparability instead comes from ranking on the share of the board a player actually found,
 * so a generous draw is worth no more than a barren one.
 */

/** UTC, so the day turns over at the same instant everywhere. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Rotates so the daily is not always the same length of round, but is equal for everyone. */
export function dailyDifficulty(dateKey: string): 0 | 1 | 2 {
  let h = 0;
  for (const c of dateKey) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return (h % 3) as 0 | 1 | 2;
}

const board   = (d: string) => `lx:daily:${d}`;
const played  = (d: string) => `lx:daily:played:${d}`;
const roundTag = (id: string) => `lx:daily:round:${id}`;
const KEEP_SECONDS = 60 * 60 * 24 * 8; // a little over a week

/** True when this player has already used today's attempt. */
export async function hasPlayedToday(playerId: string, date = todayKey()): Promise<boolean> {
  const kv = getRedis();
  if (!kv) return false;
  return (await kv.sismember(played(date), playerId.toLowerCase())) === 1;
}

/**
 * Claims today's attempt, at the moment the round opens rather than when it settles.
 * Claiming on settlement would let a player open the daily, dislike the draw, walk away and
 * try again — which is the same re-roll the seed attestation exists to prevent.
 *
 * @returns false when the attempt was already used.
 */
export async function claimTodaysAttempt(playerId: string, date = todayKey()): Promise<boolean> {
  const kv = getRedis();
  if (!kv) return true; // no store: let people play rather than block the mode entirely
  const added = await kv.sadd(played(date), playerId.toLowerCase());
  await kv.expire(played(date), KEEP_SECONDS);
  return added === 1;
}

/**
 * Remembers the seed issued for a player's daily attempt.
 *
 * When a MiniPay player sends the round themselves we never see the roundId, so we cannot tag
 * it. Matching on the seed instead is unforgeable: the seed is derived from (player, nonce) and
 * signed, so a player cannot present some other, better round as their daily one.
 */
export async function rememberDailySeed(player: string, seed: string, date = todayKey()): Promise<void> {
  const kv = getRedis();
  if (!kv) return;
  await kv.set(`lx:daily:seed:${date}:${player.toLowerCase()}`, seed, "EX", KEEP_SECONDS);
}

async function dailySeedFor(player: string, date = todayKey()): Promise<string | null> {
  const kv = getRedis();
  if (!kv) return null;
  return kv.get(`lx:daily:seed:${date}:${player.toLowerCase()}`);
}

/** Was this round the player's daily attempt? Checks the relayed tag and the self-sent seed. */
export async function resolveDailyDate(
  roundId: string, player: string, roundSeed: string,
): Promise<string | null> {
  const tagged = await dailyDateForRound(roundId);
  if (tagged) return tagged;

  const today = todayKey();
  const seed = await dailySeedFor(player, today);
  return seed && seed.toLowerCase() === roundSeed.toLowerCase() ? today : null;
}

export async function markRoundAsDaily(roundId: string, date = todayKey()): Promise<void> {
  const kv = getRedis();
  if (!kv) return;
  await kv.set(roundTag(roundId), date, "EX", KEEP_SECONDS);
}

export async function dailyDateForRound(roundId: string): Promise<string | null> {
  const kv = getRedis();
  if (!kv) return null;
  return kv.get(roundTag(roundId));
}

/**
 * Records a result on the day's board, ranked by share of the board found rather than raw
 * score, in basis points so it can live in a sorted set.
 */
export async function recordDailyResult(opts: {
  date: string; playerId: string; username: string;
  score: number; maxScore: number; wordCount: number;
}): Promise<{ percent: number } | null> {
  const kv = getRedis();
  if (!kv) return null;
  const percent = opts.maxScore > 0 ? Math.min(100, (opts.score / opts.maxScore) * 100) : 0;
  const id = opts.playerId.toLowerCase();

  await Promise.all([
    kv.zadd(board(opts.date), "GT", Math.round(percent * 100), id),
    kv.hset(`lx:u:${id}`, "username", (opts.username || "Anonymous").slice(0, 20)),
    kv.hset(`lx:daily:meta:${opts.date}:${id}`,
      "score", String(opts.score), "max", String(opts.maxScore), "words", String(opts.wordCount)),
    kv.expire(board(opts.date), KEEP_SECONDS),
    kv.expire(`lx:daily:meta:${opts.date}:${id}`, KEEP_SECONDS),
  ]);
  return { percent };
}

export type DailyRow = {
  playerId: string; username: string; percent: number;
  score: number; maxScore: number; wordCount: number;
};

export async function dailyLeaderboard(date = todayKey(), limit = 20): Promise<DailyRow[]> {
  const kv = getRedis();
  if (!kv) return [];
  const ids = await kv.zrevrange(board(date), 0, limit - 1);
  if (ids.length === 0) return [];

  const [scores, names, metas] = await Promise.all([
    Promise.all(ids.map((id) => kv.zscore(board(date), id))),
    Promise.all(ids.map((id) => kv.hget(`lx:u:${id}`, "username"))),
    Promise.all(ids.map((id) => kv.hgetall(`lx:daily:meta:${date}:${id}`))),
  ]);

  return ids.map((id, i) => ({
    playerId: id,
    username: names[i] ?? "Anonymous",
    percent: Number(scores[i] ?? 0) / 100,
    score: Number(metas[i]?.score ?? 0),
    maxScore: Number(metas[i]?.max ?? 0),
    wordCount: Number(metas[i]?.words ?? 0),
  }));
}
