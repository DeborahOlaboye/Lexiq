import "server-only";
import rawEn from "an-array-of-english-words";
import rawEs from "an-array-of-spanish-words";
import rawFr from "an-array-of-french-words";
import { MIN_WORD_LENGTH, MAX_WORD_LENGTH } from "./scoring";
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

const DICTS: Record<Lang, Set<string>> = {
  en: buildDict(rawEn),
  es: buildDict(rawEs),
  fr: buildDict(rawFr),
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
