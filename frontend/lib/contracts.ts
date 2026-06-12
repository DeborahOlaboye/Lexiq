export const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;
export const LEXIQ_ADDRESS = "" as `0x${string}`;

export const LEXIQ_ABI = [
  { name: "startRound", type: "function", stateMutability: "nonpayable", inputs: [{ name: "stakeAmount", type: "uint256" }], outputs: [{ name: "roundId", type: "uint256" }] },
  { name: "commitWord", type: "function", stateMutability: "nonpayable", inputs: [{ name: "roundId", type: "uint256" }, { name: "wordHash", type: "bytes32" }], outputs: [] },
  { name: "revealWords", type: "function", stateMutability: "nonpayable", inputs: [{ name: "roundId", type: "uint256" }, { name: "words", type: "string[]" }, { name: "salts", type: "bytes32[]" }], outputs: [] },
  { name: "getLetters", type: "function", stateMutability: "view", inputs: [{ name: "roundId", type: "uint256" }], outputs: [{ name: "letters", type: "bytes1[7]" }] },
  {
    name: "getRound", type: "function", stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [
      { name: "player", type: "address" }, { name: "letterSeed", type: "bytes32" },
      { name: "startedAt", type: "uint32" }, { name: "commitCount", type: "uint8" },
      { name: "totalScore_", type: "uint8" }, { name: "state", type: "uint8" },
      { name: "stake", type: "uint256" },
    ],
  },
  { name: "getPlayerRounds", type: "function", stateMutability: "view", inputs: [{ name: "p", type: "address" }], outputs: [{ name: "", type: "uint256[]" }] },
  { name: "totalScore", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "highScore", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "gamesPlayed", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "weeklyPrizePool", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalRounds", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "depositWeeklyPrize", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "RoundStarted", type: "event", inputs: [{ name: "roundId", type: "uint256", indexed: true }, { name: "player", type: "address", indexed: true }, { name: "letterSeed", type: "bytes32", indexed: false }] },
  { name: "WordCommitted", type: "event", inputs: [{ name: "roundId", type: "uint256", indexed: true }, { name: "slot", type: "uint8", indexed: false }] },
  { name: "WordRevealed", type: "event", inputs: [{ name: "roundId", type: "uint256", indexed: true }, { name: "word", type: "string", indexed: false }, { name: "score", type: "uint8", indexed: false }] },
  { name: "RoundFinished", type: "event", inputs: [{ name: "roundId", type: "uint256", indexed: true }, { name: "player", type: "address", indexed: true }, { name: "finalScore", type: "uint8", indexed: false }] },
] as const;

export const ERC20_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

export function scoreWord(word: string): number {
  const l = word.length;
  if (l < 2) return 0; if (l === 2) return 1; if (l === 3) return 2;
  if (l === 4) return 3; if (l === 5) return 5; if (l === 6) return 8;
  return 11;
}
