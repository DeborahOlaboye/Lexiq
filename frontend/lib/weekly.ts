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
  const ids = await kv.zrevrange(board(week), 0, limit - 1);
  if (ids.length === 0) return [];

  const [points, names] = await Promise.all([
    Promise.all(ids.map((id) => kv.zscore(board(week), id))),
    Promise.all(ids.map((id) => kv.hget(`lx:u:${id}`, "username"))),
  ]);

  return ids.map((id, i) => ({
    playerId: id,
    username: names[i] ?? "Anonymous",
    points: Number(points[i] ?? 0),
  }));
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
