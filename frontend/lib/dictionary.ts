let cache: Map<string, boolean> = new Map();

export async function isValidWord(word: string): Promise<boolean> {
  const key = word.toUpperCase();
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(`/api/validate?w=${encodeURIComponent(key)}`);
    const { valid } = await res.json();
    cache.set(key, valid);
    return valid;
  } catch {
    return true; // fail open: don't block play if API is down
  }
}
