import "server-only";
import rawEn from "an-array-of-english-words";
import rawEs from "an-array-of-spanish-words";
import rawFr from "an-array-of-french-words";
import { MIN_WORD_LENGTH, MAX_WORD_LENGTH, MAX_WORDS, scoreWord } from "./scoring";
import type { Lang } from "./guestLetters";

export function normalize(w: string): string {
  return w.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/**
 * Words shorter than MIN_WORD_LENGTH are dropped here rather than filtered at scoring time.
 * The raw list carries 128 two-letter entries (AO, EA, EF, CH…) that a player would never
 * guess but a solver would happily spam — and at a point each, enough of them cleared the
 * old stake threshold on any draw at all.
 */
function buildDict(raw: unknown): Set<string> {
  const re = new RegExp(`^[A-Z]{${MIN_WORD_LENGTH},${MAX_WORD_LENGTH}}$`);
  return new Set((raw as string[]).map(normalize).filter((w) => re.test(w)));
}

/**
 * Words the source list predates. It is a large, generally good list — it carries both British
 * and American spellings, so COLOUR and COLOR both play — but it is old enough to miss words
 * that are entirely ordinary to the players we have.
 */
const SUPPLEMENT: Record<Lang, string[]> = {
  // Nothing over seven letters: with seven tiles and no reuse, a longer entry can never be
  // played, so it would only ever be dead weight in the set.
  en: [
    "SELFIE", "WIFI", "EMOJI", "BLOGGER", "PODCAST", "TWEETED",
    "HASHTAG", "MEMES", "TEXTED", "SIMCARD", "AIRTIME", "TOPUP", "FINTECH",
  ],
  es: ["SELFIE", "TUITEAR", "EMOJI", "MEMES", "BLOG"],
  fr: ["SELFIE", "TWEETER", "EMOJI", "MEMES", "BLOG"],
};

function withSupplement(base: Set<string>, extra: string[]): Set<string> {
  const re = new RegExp(`^[A-Z]{${MIN_WORD_LENGTH},${MAX_WORD_LENGTH}}$`);
  for (const w of extra) {
    const n = normalize(w);
    if (re.test(n)) base.add(n);
  }
  return base;
}

const DICTS: Record<Lang, Set<string>> = {
  en: withSupplement(buildDict(rawEn), SUPPLEMENT.en),
  es: withSupplement(buildDict(rawEs), SUPPLEMENT.es),
  fr: withSupplement(buildDict(rawFr), SUPPLEMENT.fr),
};

export function dictFor(lang: Lang): Set<string> {
  return DICTS[lang] ?? DICTS.en;
}

export function isWord(word: string, lang: Lang): boolean {
  return dictFor(lang).has(normalize(word));
}

/** True when `word` can be built from `letters` without reusing a tile. */
export function usesAvailableLetters(word: string, letters: string): boolean {
  const pool: Record<string, number> = {};
  for (const c of letters.toUpperCase()) pool[c] = (pool[c] ?? 0) + 1;
  for (const c of word.toUpperCase()) {
    if (!pool[c]) return false;
    pool[c]--;
  }
  return true;
}

/**
 * Server-side gate on a submission. The contract no longer sees the words at all, so this is
 * the only thing standing between a player and an arbitrary score — it checks the dictionary
 * and that every letter was actually on that round's board.
 */
export function acceptWords(words: string[], letters: string, lang: Lang, max: number): string[] {
  const dict = dictFor(lang);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const w = normalize(raw);
    if (seen.has(w)) continue;
    if (!dict.has(w)) continue;
    if (!usesAvailableLetters(w, letters)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

/** Every valid word on a board, best first. */
export function solveBoard(letters: string, lang: Lang): { word: string; pts: number }[] {
  return [...dictFor(lang)]
    .filter((w) => usesAvailableLetters(w, letters))
    .map((w) => ({ word: w, pts: scoreWord(w) }))
    .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));
}

/**
 * The best score actually reachable on a board — the top `cap` words, since that is all a
 * player may submit. Used to score a round as a share of what was there, so boards of
 * differing generosity can be compared with each other.
 *
 * Solving walks the whole dictionary, so results are memoised. This process is long-lived
 * (a container, not a lambda), so the cache survives between requests and a popular board is
 * solved once.
 */
const maxScoreCache = new Map<string, number>();

export function boardMaxScore(letters: string, lang: Lang, cap = MAX_WORDS): number {
  const key = `${lang}:${letters}:${cap}`;
  const hit = maxScoreCache.get(key);
  if (hit !== undefined) return hit;

  const total = solveBoard(letters, lang).slice(0, cap).reduce((sum, w) => sum + w.pts, 0);
  // Bounded so a long-running process cannot grow this without limit.
  if (maxScoreCache.size > 5000) maxScoreCache.clear();
  maxScoreCache.set(key, total);
  return total;
}
