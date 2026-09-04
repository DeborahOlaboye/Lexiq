/**
 * Short, stable hash of a word, used to validate a guess in the browser without a round trip.
 *
 * A round hands the client the hashes of every word playable on its board, so typing feedback
 * is instant and works on a bad connection — the old behaviour asked the server about every
 * word, which on 3G made the board feel broken during a 90-second game.
 *
 * Hashes rather than the words themselves: the plaintext set would be a readable answer key
 * in devtools. Hashing does not make the board secret — the letters are public on-chain and
 * anyone determined can solve it offline — it just declines to hand the answers over.
 *
 * FNV-1a: tiny, dependency-free, and identical in the browser and on the server. Collisions
 * are harmless; the server revalidates everything at settlement, so a false positive costs a
 * player nothing more than a word that scores zero.
 */
export function wordHash(word: string): string {
  let h = 0x811c9dc5;
  const w = word.toUpperCase();
  for (let i = 0; i < w.length; i++) {
    h ^= w.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function hashAll(words: string[]): string[] {
  return words.map(wordHash);
}
