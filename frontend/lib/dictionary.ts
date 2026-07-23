import type { Lang } from "./guestLetters";

const cache = new Map<string, boolean>();

export async function isValidWord(word: string, lang: Lang = "en"): Promise<boolean> {
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
