import rawWords from "an-array-of-english-words";

// Set of valid uppercase English words, 2–7 letters
const WORDS: Set<string> = new Set(
  (rawWords as string[])
    .filter((w) => w.length >= 2 && w.length <= 7)
    .map((w) => w.toUpperCase())
);

export function isValidWord(word: string): boolean {
  return WORDS.has(word.toUpperCase());
}
