import "server-only";
import { getRedis } from "./redis";

/**
 * Which opponent a round is being played against.
 *
 * The level used to be the round's on-chain difficulty, which tied the opponent's strength to
 * the length of the clock: the only way to face Relentless was to accept sixty seconds instead
 * of ninety. A strong player wanting a real opponent at a normal pace had no way to ask, and a
 * weak player wanting more time had to take the hardest agent with it. They are two different
 * questions and this lets them be answered separately.
 *
 * Locked on first write. The level is fixed the moment the board is loaded and cannot be
 * lowered afterwards, so nobody picks an easier opponent once they know their own score. That
 * matters less than it would if a prize rode on it — nothing is staked on beating the agent —
 * but a result that can be edited after the fact is not worth showing at all.
 */

const KEY = (roundId: string) => `lx:vs:${roundId}`;
/** Long enough to outlive any round, short enough not to accumulate. */
const TTL_SECONDS = 60 * 60 * 24;

function valid(level: unknown): level is number {
  return typeof level === "number" && Number.isInteger(level) && level >= 0 && level <= 2;
}

/**
 * Records the chosen opponent for a round, or returns the one already recorded.
 * Falls back to `fallback` — the round's own difficulty — when there is no choice on file.
 */
export async function lockVersusLevel(
  roundId: string, requested: unknown, fallback: number,
): Promise<number> {
  const kv = getRedis();
  if (!kv) return valid(requested) ? requested : fallback;

  try {
    if (valid(requested)) {
      // SETNX: the first call decides, every later one only reads.
      const won = await kv.set(KEY(roundId), String(requested), "EX", TTL_SECONDS, "NX");
      if (won) return requested;
    }
    const stored = await kv.get(KEY(roundId));
    if (stored !== null) {
      const n = Number(stored);
      if (valid(n)) return n;
    }
  } catch (e) {
    console.error("[versus] level", (e as Error).message);
  }
  return fallback;
}

/** Reads without recording, for settling — which must never be the thing that sets the level. */
export async function readVersusLevel(roundId: string, fallback: number): Promise<number> {
  const kv = getRedis();
  if (!kv) return fallback;
  try {
    const stored = await kv.get(KEY(roundId));
    if (stored !== null) {
      const n = Number(stored);
      if (valid(n)) return n;
    }
  } catch { /* fall through to the round's own difficulty */ }
  return fallback;
}
