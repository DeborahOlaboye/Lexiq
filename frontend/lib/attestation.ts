import "server-only";
import { createWalletClient, createPublicClient, http, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ROUND } from "./contracts";

export const RPC = "https://forno.celo.org";

/**
 * Signs the score and seed attestations the contract verifies. This key is authoritative
 * over scoring — it must never be the relayer key, which only pays gas.
 */
/**
 * Tolerates how a key actually arrives in an environment file — surrounding quotes, trailing
 * whitespace, a missing 0x. Passing those straight through fails with "invalid private key,
 * expected hex or 32 bytes, got string", which points at the code rather than at the value.
 */
function accountFrom(envVar: string) {
  const raw = process.env[envVar];
  if (!raw) throw new Error(`${envVar} not configured`);
  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  const key = (cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`${envVar} is not a 32-byte hex key (got ${cleaned.length} chars)`);
  }
  return privateKeyToAccount(key);
}

function signerAccount() {
  return accountFrom("GAME_SIGNER_PRIVATE_KEY");
}

export function relayerAccount() {
  return accountFrom("RELAYER_PRIVATE_KEY");
}

export const publicClient = createPublicClient({ chain: celo, transport: http(RPC) });

export function relayerWallet() {
  return createWalletClient({ account: relayerAccount(), chain: celo, transport: http(RPC) });
}

const domain = {
  name: "Lexiq",
  version: "2",
  chainId: celo.id,
  verifyingContract: LEXIQ_ADDRESS,
} as const;

const SEED_TYPES = {
  Seed: [
    { name: "player",     type: "address" },
    { name: "nonce",      type: "uint256" },
    { name: "difficulty", type: "uint8"   },
    { name: "lang",       type: "uint8"   },
    { name: "seed",       type: "bytes32" },
    { name: "deadline",   type: "uint256" },
  ],
} as const;

const SCORE_TYPES = {
  Score: [
    { name: "roundId",   type: "uint256" },
    { name: "player",    type: "address" },
    { name: "score",     type: "uint16"  },
    { name: "wordCount", type: "uint8"   },
    { name: "deadline",  type: "uint256" },
  ],
} as const;

/** Attestations are short-lived so a signed result can't be banked and replayed later. */
export const SEED_TTL_SECONDS  = 10 * 60;
export const SCORE_TTL_SECONDS = 10 * 60;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Derives a player's seed for a given round index. Deterministic, so asking twice returns
 * the same draw — otherwise a player could keep requesting seeds and start the round only
 * once they liked the letters.
 */
export function deriveSeed(player: string, nonce: bigint): `0x${string}` {
  const secret = process.env.SEED_SECRET;
  if (!secret) throw new Error("SEED_SECRET not configured");
  return keccak256(
    encodePacked(["string", "address", "uint256"], [secret, player as `0x${string}`, nonce]),
  );
}

export async function signSeed(player: string, nonce: bigint, difficulty: number, lang: number) {
  const seed = deriveSeed(player, nonce);
  const deadline = BigInt(nowSeconds() + SEED_TTL_SECONDS);
  const signature = await signerAccount().signTypedData({
    domain, types: SEED_TYPES, primaryType: "Seed",
    message: { player: player as `0x${string}`, nonce, difficulty, lang, seed, deadline },
  });
  return { seed, deadline, signature };
}

export async function signScore(
  roundId: bigint, player: string, score: number, wordCount: number,
) {
  const deadline = BigInt(nowSeconds() + SCORE_TTL_SECONDS);
  const signature = await signerAccount().signTypedData({
    domain, types: SCORE_TYPES, primaryType: "Score",
    message: { roundId, player: player as `0x${string}`, score, wordCount, deadline },
  });
  return { deadline, signature };
}

/**
 * Fees for relayed writes, paid in native CELO.
 *
 * Deliberately no feeCurrency: CIP-64 fee abstraction exists so a MiniPay user holding only
 * stablecoins can transact. The relayer is our own server wallet and holds CELO, so naming a
 * fee currency would spend down its stablecoin balance while its CELO sat idle. Player-signed
 * transactions still use celoFee() — they are the ones who need abstraction.
 */
export async function relayFees() {
  const gp = await publicClient.getGasPrice();
  return {
    maxFeePerGas: gp + gp / 5n,
    maxPriorityFeePerGas: gp / 10n,
  };
}

/**
 * Reads a round's letters, waiting until the node actually has the round.
 *
 * `getLetters` on a round that does not exist does not revert — it derives from a zeroed
 * struct and returns letters that look entirely plausible. A public RPC is load balanced, so
 * a read issued right after a receipt can land on a node a block or two behind and hand back
 * those phantom letters, which the player then plays and cannot possibly score against.
 * Confirm the round is really there before trusting them.
 */
export async function lettersForRound(
  roundId: bigint, expectedPlayer: `0x${string}`, attempts = 10,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const round = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getRound", args: [roundId],
    }) as readonly unknown[];

    if ((round[ROUND.player] as string).toLowerCase() === expectedPlayer.toLowerCase()) {
      const raw = await publicClient.readContract({
        address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getLetters", args: [roundId],
      }) as readonly `0x${string}`[];
      const letters = raw.map((b) => String.fromCharCode(parseInt(b.slice(2), 16))).join("");
      // A zeroed struct still yields seven letters, so re-check rather than trust the shape.
      if (/^[A-Z]{7}$/.test(letters)) return letters;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`round ${roundId} not visible on-chain after ${attempts} attempts`);
}
