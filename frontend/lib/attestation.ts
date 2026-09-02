import "server-only";
import { createWalletClient, createPublicClient, http, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { LEXIQ_ADDRESS } from "./contracts";

export const RPC = "https://forno.celo.org";

/**
 * Signs the score and seed attestations the contract verifies. This key is authoritative
 * over scoring — it must never be the relayer key, which only pays gas.
 */
function signerAccount() {
  const pk = process.env.GAME_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("GAME_SIGNER_PRIVATE_KEY not configured");
  return privateKeyToAccount(pk);
}

export function relayerAccount() {
  const pk = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY not configured");
  return privateKeyToAccount(pk);
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

export async function signSeed(player: string, nonce: bigint, difficulty: number) {
  const seed = deriveSeed(player, nonce);
  const deadline = BigInt(nowSeconds() + SEED_TTL_SECONDS);
  const signature = await signerAccount().signTypedData({
    domain, types: SEED_TYPES, primaryType: "Seed",
    message: { player: player as `0x${string}`, nonce, difficulty, seed, deadline },
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
 * CIP-64 fee abstraction for relayed writes, so the relayer never needs CELO. It is a typed
 * (0x7b) transaction carrying EIP-1559 fields, so gasPrice can't be paired with feeCurrency —
 * the price is expressed as maxFeePerGas instead.
 */
export async function relayFees(feeCurrency: `0x${string}`) {
  const gp = await publicClient.getGasPrice();
  return {
    maxFeePerGas: gp + gp / 5n,
    maxPriorityFeePerGas: gp / 10n,
    feeCurrency,
  };
}
