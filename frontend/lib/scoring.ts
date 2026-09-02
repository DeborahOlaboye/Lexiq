/**
 * Scoring — the single source of truth for both the browser and the signing server.
 *
 * The server's number is the one that gets signed into a score attestation and settled
 * on-chain, so if the client scored words differently the board would disagree with the
 * result. Both import from here.
 */

/** Two-letter words are excluded. See MIN_WORD_LENGTH note below. */
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 7;

/** Mirrors MAX_WORDS in Lexiq.sol. Words are no longer stored on-chain, so this is only
 *  a sanity bound rather than a storage cost. */
export const MAX_WORDS = 30;

/**
 * Scrabble letter values. Without these, QUIZ and AREA both score as "4 letters" — which
 * makes vocabulary worthless and leaves Hard difficulty (which deals more J/K/Q/X/Z) as
 * pure downside with no compensating upside.
 */
const LETTER_VALUES: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
};

/**
 * Added on top of the letter values. Scaled steeply so a seven-letter word still reads as
 * the jackpot: common long words are all one-point letters, so a flat bonus would let QUIZ
 * outscore RETAINS and the "use all seven" moment would lose its punch.
 */
const LENGTH_BONUS: Record<number, number> = { 3: 2, 4: 5, 5: 10, 6: 18, 7: 30 };

export function scoreWord(word: string): number {
  const w = word.toUpperCase();
  if (w.length < MIN_WORD_LENGTH || w.length > MAX_WORD_LENGTH) return 0;
  let total = 0;
  for (const c of w) total += LETTER_VALUES[c] ?? 0;
  return total + (LENGTH_BONUS[w.length] ?? 0);
}

/** Point value of a single tile, for the per-tile numerals on the board. */
export function letterValue(letter: string): number {
  return LETTER_VALUES[letter.toUpperCase()] ?? 0;
}

export function scoreWords(words: string[]): number {
  return words.reduce((sum, w) => sum + scoreWord(w), 0);
}
