const cache = new Map<string, boolean>();

export async function isValidWord(word: string): Promise<boolean> {
  const key = word.toUpperCase();
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(`/api/validate?w=${encodeURIComponent(key)}`);
    if (!res.ok) { cache.set(key, false); return false; }
    const { valid } = await res.json();
    cache.set(key, !!valid);
    return !!valid;
  } catch {
    // API unreachable — fail closed so no invalid words slip through
    return false;
  }
}

/** Batch-validate an array of words. Returns Set of valid words. */
export async function validateWords(words: string[]): Promise<Set<string>> {
  const results = await Promise.all(words.map(async (w) => ({ w: w.toUpperCase(), ok: await isValidWord(w) })));
  return new Set(results.filter((r) => r.ok).map((r) => r.w));
}
