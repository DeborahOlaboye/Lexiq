import "server-only";
import { getRedis } from "./redis";

/**
 * The weekly prize board.
 *
 * Players do not stake. The pool is funded by us and split among the best players of the week,
 * which keeps this a skill contest with a sponsored prize rather than something where a player
 * can lose their own money — a materially different proposition in the markets MiniPay serves,
 * and one that removes every incentive to game a stake.
 *
 * Ranked on points accumulated across the week rather than a single best round, so the prize
 * rewards playing regularly rather than getting one lucky board.
 */

const KEEP_SECONDS = 60 * 60 * 24 * 60; // two months, so a week stays auditable after payout

/** ISO-8601 week, e.g. 2026-W36. UTC, so the week turns over at one instant everywhere. */
export function weekKey(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Thursday of the current week decides the year, per ISO-8601.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const board = (w: string) => `lx:week:${w}`;

/** Adds a finished round's points to the player's running total for the week. */
export async function addWeeklyPoints(opts: {
  playerId: string; username: string; points: number; week?: string;
}): Promise<void> {
  const kv = getRedis();
  if (!kv || opts.points <= 0) return;
  const week = opts.week ?? weekKey();
  const id = opts.playerId.toLowerCase();

  await Promise.all([
    kv.zincrby(board(week), opts.points, id),
    kv.hset(`lx:u:${id}`, "username", (opts.username || "Anonymous").slice(0, 20)),
    kv.expire(board(week), KEEP_SECONDS),
  ]);
}

export type WeeklyRow = { playerId: string; username: string; points: number };

export async function weeklyLeaderboard(week = weekKey(), limit = 20): Promise<WeeklyRow[]> {
  const kv = getRedis();
  if (!kv) return [];
  // WITHSCORES brings the points back with the ids, and the names follow in one pipeline,
  // so a twenty-player board costs two round trips rather than forty-one.
  const flat = await kv.zrevrange(board(week), 0, limit - 1, "WITHSCORES");
  if (flat.length === 0) return [];

  const ids: string[] = [];
  const points: number[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    ids.push(flat[i]);
    points.push(Number(flat[i + 1] ?? 0));
  }

  const pipe = kv.pipeline();
  ids.forEach((id) => pipe.hget(`lx:u:${id}`, "username"));
  const names = await pipe.exec();

  return ids.map((id, i) => ({
    playerId: id,
    username: (names?.[i]?.[1] as string) ?? "Anonymous",
    points: points[i],
  }));
}

export type WeeklyStanding = {
  /** 1-based position on the board, or null if this player has not scored this week. */
  rank: number | null;
  points: number;
  /** How many players are on the board, so a rank can be read as "of N". */
  total: number;
  /** Points needed to pass the player immediately above. Null when already first. */
  toNext: number | null;
};

/**
 * Where one player stands, looked up directly rather than searched for in the visible rows.
 *
 * The board only ever returns its top twenty, so anything that located a player by scanning
 * those rows reported nothing at all for the twenty-first — the lobby's rank tile showed a dash
 * to exactly the players most in need of a reason to come back. A sorted set already knows
 * every rank, so ask it.
 *
 * `toNext` is the useful half: a position is static, but "nine points from twelfth" is
 * something a player can act on in one more round.
 */
export async function weeklyStanding(playerId: string, week = weekKey()): Promise<WeeklyStanding | null> {
  const kv = getRedis();
  if (!kv) return null;
  const id = playerId.toLowerCase();
  const key = board(week);

  try {
    const [rankFromTop, score, total] = await Promise.all([
      kv.zrevrank(key, id),
      kv.zscore(key, id),
      kv.zcard(key),
    ]);
    if (rankFromTop === null || rankFromTop === undefined || score === null) {
      return { rank: null, points: 0, total: Number(total ?? 0), toNext: null };
    }

    const points = Number(score);
    // The player one place above, so the gap is a real number rather than an estimate.
    let toNext: number | null = null;
    if (rankFromTop > 0) {
      const above = await kv.zrevrange(key, rankFromTop - 1, rankFromTop - 1, "WITHSCORES");
      const aboveScore = Number(above[1] ?? points);
      // +1 because matching the score above still leaves you behind it.
      toNext = Math.max(1, Math.ceil(aboveScore - points) + 1);
    }

    return { rank: rankFromTop + 1, points, total: Number(total ?? 0), toNext };
  } catch (e) {
    console.error("[weekly] standing", (e as Error).message);
    return null;
  }
}

/** Seconds until this week's board closes, for the countdown in the UI. */
export function secondsUntilWeekEnd(now: Date = new Date()): number {
  const d = new Date(now);
  const daysToMonday = ((8 - (d.getUTCDay() || 7)) % 7) || 7;
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToMonday);
  return Math.max(0, Math.floor((end - now.getTime()) / 1000));
}

/**
 * Coverage above which a submission stops looking like someone typing.
 *
 * Real play sits far below this — a settled round on mainnet found 139 of a possible 604, or
 * 23%, and a strong human might reach 40–50%. Clearing most of a board means a solver, not
 * hands on a phone keyboard.
 *
 * Deliberately generous, and it flags rather than rejects: the threshold is a guess until
 * there is real data behind it, and refusing a genuinely brilliant round would be worse than
 * paying one out. Review flags before a payout rather than trusting a number picked in advance.
 */
export const IMPLAUSIBLE_COVERAGE = 75;

export async function flagIfImplausible(opts: {
  playerId: string; username: string; roundId: string;
  score: number; maxScore: number; percent: number; wordCount: number;
}): Promise<boolean> {
  if (opts.percent < IMPLAUSIBLE_COVERAGE) return false;

  console.warn(
    `[flag] round ${opts.roundId} by ${opts.playerId} covered ${opts.percent}% ` +
    `(${opts.score}/${opts.maxScore}, ${opts.wordCount} words)`,
  );

  const kv = getRedis();
  if (!kv) return true;
  const week = weekKey();
  await kv.rpush(`lx:flagged:${week}`, JSON.stringify({
    at: new Date().toISOString(),
    playerId: opts.playerId.toLowerCase(),
    username: opts.username,
    roundId: opts.roundId,
    percent: opts.percent,
    score: opts.score,
    maxScore: opts.maxScore,
    words: opts.wordCount,
  }));
  await kv.expire(`lx:flagged:${week}`, 60 * 60 * 24 * 60);
  return true;
}
