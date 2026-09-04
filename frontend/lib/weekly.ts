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
