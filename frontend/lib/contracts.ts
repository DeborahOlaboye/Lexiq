export const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

/** Lexiq v2. Set after deploying — see contracts/scripts/deploy.ts. */
export const LEXIQ_ADDRESS = (process.env.NEXT_PUBLIC_LEXIQ_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

/** Round tuple indices returned by getRound(). */
export const ROUND = {
  player: 0, seed: 1, startedAt: 2, difficulty: 3, lang: 4,
  score: 5, wordCount: 6, state: 7, stake: 8,
} as const;

/** Round.lang values, matching LANG_* in Lexiq.sol. */
export const LANG_ID: Record<string, number> = { en: 0, es: 1, fr: 2 };
export const LANG_BY_ID = ["en", "es", "fr"] as const;

export const ROUND_ACTIVE = 0;
export const ROUND_FINISHED = 1;

export const LEXIQ_ABI = [
  // ── Starting rounds ──
  { name: "startRoundFor", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "player", type: "address" }, { name: "difficulty", type: "uint8" },
      { name: "lang", type: "uint8" },
      { name: "seed", type: "bytes32" }, { name: "deadline", type: "uint256" },
      { name: "seedSig", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "startRound", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "stakeAmount", type: "uint256" }, { name: "difficulty", type: "uint8" },
      { name: "lang", type: "uint8" },
      { name: "seed", type: "bytes32" }, { name: "deadline", type: "uint256" },
      { name: "seedSig", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "startChallenge", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "originalRoundId", type: "uint256" }, { name: "stakeAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },

  // ── Finishing ──
  { name: "submitRound", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" }, { name: "score", type: "uint16" },
      { name: "wordCount", type: "uint8" }, { name: "deadline", type: "uint256" },
      { name: "scoreSig", type: "bytes" },
    ],
    outputs: [] },

  // ── Views ──
  { name: "getLetters", type: "function", stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes1[7]" }] },
  { name: "getRound", type: "function", stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [
      { name: "player", type: "address" }, { name: "seed", type: "bytes32" },
      { name: "startedAt", type: "uint32" }, { name: "difficulty", type: "uint8" },
      { name: "lang", type: "uint8" },
      { name: "score", type: "uint16" }, { name: "wordCount", type: "uint8" },
      { name: "state", type: "uint8" }, { name: "stake", type: "uint256" },
    ] },
  { name: "roundNonce", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "roundDuration", type: "function", stateMutability: "view",
    inputs: [{ name: "difficulty", type: "uint8" }], outputs: [{ name: "", type: "uint32" }] },
  { name: "totalScore", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "highScore", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "gamesPlayed", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getPlayerRounds", type: "function", stateMutability: "view",
    inputs: [{ name: "p", type: "address" }], outputs: [{ name: "", type: "uint256[]" }] },
  { name: "playerRoundCount", type: "function", stateMutability: "view",
    inputs: [{ name: "p", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "weeklyPrizePool", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "stakeThreshold", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint16" }] },
  { name: "totalRounds", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "depositWeeklyPrize", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }], outputs: [] },

  // ── Events ──
  { name: "RoundStarted", type: "event", inputs: [
    { name: "roundId", type: "uint256", indexed: true }, { name: "player", type: "address", indexed: true },
    { name: "difficulty", type: "uint8", indexed: false }, { name: "lang", type: "uint8", indexed: false },
    { name: "stake", type: "uint256", indexed: false }] },
  { name: "RoundFinished", type: "event", inputs: [
    { name: "roundId", type: "uint256", indexed: true }, { name: "player", type: "address", indexed: true },
    { name: "score", type: "uint16", indexed: false }, { name: "wordCount", type: "uint8", indexed: false }] },
  { name: "StakeReturned", type: "event", inputs: [
    { name: "roundId", type: "uint256", indexed: true }, { name: "player", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false }] },
  { name: "ChallengeStarted", type: "event", inputs: [
    { name: "roundId", type: "uint256", indexed: true }, { name: "originalRoundId", type: "uint256", indexed: true },
    { name: "challenger", type: "address", indexed: true }] },
] as const;

export const ERC20_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

export { scoreWord } from "./scoring";
