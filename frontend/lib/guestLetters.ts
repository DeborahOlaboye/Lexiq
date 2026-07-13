const FREQ = "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";

export function generateGuestLetters(): string {
  const arr = new Uint8Array(7);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => FREQ[b % FREQ.length]).join("");
}
