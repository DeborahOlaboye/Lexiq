export type Lang = "en" | "es" | "fr";

// Letter frequency tables per language (A-Z only, no accents).
// Proportions approximate real-language corpus distributions.
const FREQ: Record<Lang, string> = {
  en: "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ",
  // Spanish: high A/E/O, no Ñ (we keep A-Z only)
  es: "AAAAAAAAAAAAEEEEEEEEEEEEEEOOOOOOOOSSSSSSSNNNNNNNRRRRRRRIIIIIIILLLLLDDDDDDTTTTTCCCCUUUUMMMPPBBGVYFHZ",
  // French: extremely high E, high A/I/S/T/N
  fr: "EEEEEEEEEEEEEEEEEAAAAAAAASSSSSSSIIIIIIIITTTTTTTNNNNNNNRRRRRRRUUUUUULLLLLOOOOODDDCCCMMMPPPVVGFBQHZ",
};

export function generateGuestLetters(lang: Lang = "en"): string {
  const freq = FREQ[lang];
  const arr  = new Uint8Array(7);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => freq[b % freq.length]).join("");
}
