import type { Lang } from "./guestLetters";
import { wordHash } from "./wordhash";

const cache = new Map<string, boolean>();

/**
 * Hashes of every word playable on the current board, handed over when the round opens.
 * With these, typing feedback is local and instant; without them we fall back to asking the
 * server, which is a round trip per word and unusable on a slow connection.
 */
let boardHashes: Set<string> | null = null;

export function setBoardWords(hashes: string[] | undefined): void {
  boardHashes = hashes && hashes.length ? new Set(hashes) : null;
  cache.clear();
}

export function clearBoardWords(): void {
  boardHashes = null;
  cache.clear();
}

export function hasBoardWords(): boolean {
  return boardHashes !== null;
}

/** Synchronous when the board's hashes are loaded, which is the normal case mid-round. */
export function isValidWordSync(word: string): boolean | null {
  if (!boardHashes) return null;
  return boardHashes.has(wordHash(word));
}

export async function isValidWord(word: string, lang: Lang = "en"): Promise<boolean> {
  const local = isValidWordSync(word);
  if (local !== null) return local;

  const key = `${lang}:${word.toUpperCase()}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(`/api/validate?w=${encodeURIComponent(word.toUpperCase())}&lang=${lang}`);
    if (!res.ok) { cache.set(key, false); return false; }
    const { valid } = await res.json();
    cache.set(key, !!valid);
    return !!valid;
  } catch {
    return false;
  }
}

/** Batch-validate an array of words. Returns Set of valid words. */
export async function validateWords(words: string[], lang: Lang = "en"): Promise<Set<string>> {
  const results = await Promise.all(words.map(async (w) => ({ w: w.toUpperCase(), ok: await isValidWord(w, lang) })));
  return new Set(results.filter((r) => r.ok).map((r) => r.w));
}
