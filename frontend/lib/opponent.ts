import "server-only";
import { solveBoard, boardMaxScore } from "./wordlist";
import { scoreWord, scoreWords, MAX_WORDS } from "./scoring";
import type { Lang } from "./guestLetters";

/**
 * The opponent agent's play.
 *
 * Two properties matter more than how well it plays.
 *
 * It is derived from the round's seed, so its words are fixed the moment the round opens —
 * before the player has typed anything. The agent therefore cannot watch a player pull ahead
 * and find another word, which is the difference between an opponent and a house that always
 * wins. Anyone can recompute this from the seed afterwards and check what it was owed.
 *
 * And it plays like a person rather than like a solver. An agent that took everything would
 * be unbeatable, and would also trip the same implausible-coverage check that flags a human
 * cheating in lib/weekly.ts, so every level sits far below that threshold. See COVERAGE for
 * how the levels were calibrated against rounds people have actually played.
 */

/**
 * Share of the board's reachable score the agent aims for, by level.
 *
 * Calibrated against real settled rounds, not intuition: players have scored 54 of a possible
 * 372 (15%), 48 of 462 (10%) and 34 of 364 (9%). An earlier draft aimed at 22% on its easiest
 * setting, which would have beaten every human who has ever played and never once paid out.
 * Casual now loses to an average round, Sharp beats it, and Relentless needs a genuinely good
 * one — so the prize is winnable and still worth winning.
 */
const COVERAGE: Record<number, number> = { 0: 0.07, 1: 0.14, 2: 0.22 };

export const LEVEL_NAMES: Record<number, string> = { 0: "Casual", 1: "Sharp", 2: "Relentless" };

/** Deterministic PRNG. Same seed, same game, every time and on every machine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Folds the whole seed in, so two seeds sharing a prefix do not play the same game. */
function seedToInt(seed: string): number {
  let h = 2166136261 >>> 0;
  for (const ch of seed.replace(/^0x/, "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export type OpponentPlay = {
  words: string[];
  score: number;
  /** Percent of the board's reachable score, for display and for sanity checks. */
  coverage: number;
  level: number;
};

/**
 * What the agent played on this board.
 *
 * Pure: the same arguments always give the same play, which is what lets the result be
 * checked independently rather than taken on trust.
 */
export function opponentPlay(opts: {
  seed: string;
  letters: string;
  lang: Lang;
  level: number;
}): OpponentPlay {
  const level = COVERAGE[opts.level] !== undefined ? opts.level : 1;
  const rand = mulberry32(seedToInt(opts.seed) ^ (level * 0x9e3779b9));

  const board = solveBoard(opts.letters, opts.lang);
  if (board.length === 0) return { words: [], score: 0, coverage: 0, level };

  const max = boardMaxScore(opts.letters, opts.lang);
  const target = Math.round(max * COVERAGE[level]);

  // Weighted by value but deliberately noisy: a strict top-N pick would take only the long
  // words, which is not how anyone actually plays. The noise lets shorter words through and
  // gives each seed a different-looking game.
  const ordered = board
    .map((w) => ({ ...w, weight: w.pts * (0.45 + 0.55 * rand()) }))
    .sort((a, b) => b.weight - a.weight);

  // Take a word only when it moves the running total closer to the target. Simply adding
  // until the target is crossed overshoots badly on a coarse board — one long word can land
  // 55% past it, which is how an "easy" setting ended up beating a real player's round. This
  // also raises the word count towards what people actually play, because once the total is
  // near the target only the smaller words still fit.
  const words: string[] = [];
  let score = 0;
  for (const w of ordered) {
    if (words.length >= MAX_WORDS) break;
    if (Math.abs(score + w.pts - target) >= Math.abs(score - target)) continue;
    words.push(w.word);
    score += w.pts;
  }

  return {
    words,
    // Scored through the same function as a player's submission, so the two are always
    // comparable and cannot drift apart.
    score: scoreWords(words),
    coverage: max > 0 ? Math.round((score / max) * 100) : 0,
    level,
  };
}

/**
 * When the agent's score arrives, so it climbs through the round instead of sitting there.
 *
 * Its words are decided by the seed before anyone plays, which is what makes the result
 * checkable — but a finished number on screen from the first second reads as though the
 * opponent had banked its points while you sat at zero. Spreading the same words across the
 * round makes it a race you are actually in, and changes nothing about where it ends up.
 *
 * Only the running total goes to the browser. Sending the words themselves mid-round would
 * hand a player the answers, so this deliberately returns scores and nothing else.
 *
 * Seeded from the round, so the pacing is identical on every device and reproducible after
 * the fact — the same property the play itself has.
 */
export function opponentTicks(
  play: OpponentPlay,
  seconds: number,
  seed: string,
): Array<{ at: number; score: number }> {
  if (play.words.length === 0 || seconds <= 0) return [];
  const rand = mulberry32(seedToInt(seed) ^ 0x5bf03635);

  // Inside the round rather than at its edges: nothing lands on the first or last breath,
  // so the agent looks like it is playing rather than dumping a score at the buzzer.
  const times = play.words
    .map(() => (0.08 + 0.82 * rand()) * seconds)
    .sort((a, b) => a - b);

  let running = 0;
  return play.words.map((word, i) => {
    running += scoreWord(word);
    return { at: Math.round(times[i]), score: running };
  });
}
