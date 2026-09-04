"use client";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { decodeEventLog } from "viem";
import { wagmiConfig } from "./wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "./contracts";
import { celoFee } from "./minipay";
import { getAttributionTag } from "./attribution";
import { savePlayToken, getPlayToken } from "./playSession";
import { setBoardWords } from "./dictionary";
import type { Lang } from "./guestLetters";

/**
 * The MiniPay path: the player sends their own transactions and pays the network fee in
 * whichever stablecoin they hold.
 *
 * Nothing is sponsored here by design. Celo fees are sub-cent and payable in stablecoins, so
 * a MiniPay wallet — which arrives already funded — has no friction to remove. Guests and
 * signed-in players are relayed instead, because they genuinely cannot pay: a guest has no
 * wallet, and a Privy embedded wallet is created empty.
 *
 * The contract supports both without a redeploy: startRound accepts a zero stake, and
 * submitRound is gated on the server's attestation rather than on being the relayer.
 */

/** Opens a free round that the player pays for. Returns the round id. */
export async function selfStartRound(opts: {
  player: `0x${string}`;
  difficulty: number;
  lang: Lang;
  feeCurrency: `0x${string}`;
  daily?: boolean;
}): Promise<bigint> {
  const res = await fetch("/api/round/seed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      player: opts.player, difficulty: opts.difficulty, lang: opts.lang,
      daily: opts.daily,
    }),
  });
  const seed = await res.json();
  if (!res.ok) throw new Error(seed.error ?? "Could not start round");
  savePlayToken(seed.playToken);

  const tag = getAttributionTag();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hash = await (writeContract as any)(wagmiConfig, {
    address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "startRound",
    args: [0n, seed.difficulty, seed.lang, seed.seed, BigInt(seed.deadline), seed.signature],
    ...celoFee(opts.feeCurrency),
    ...(tag ? { dataSuffix: tag } : {}),
  });
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== LEXIQ_ADDRESS.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: LEXIQ_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === "RoundStarted") {
        const roundId = (ev.args as unknown as { roundId: bigint }).roundId;
        await loadBoardWords(roundId);
        return roundId;
      }
    } catch { /* not our event */ }
  }
  throw new Error("Round did not open");
}

/** Local word validation needs the board's hashes; the relayed path gets them from /start. */
async function loadBoardWords(roundId: bigint): Promise<void> {
  try {
    const res = await fetch("/api/round/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId: roundId.toString(), playToken: getPlayToken() }),
    });
    if (res.ok) setBoardWords((await res.json()).wordHashes);
  } catch { /* falls back to asking the server per word */ }
}

export type SelfSettleResult = {
  score: number; maxScore: number; percent: number;
  words: string[]; wordCount: number; txHash: `0x${string}`;
};

/**
 * Scores the round on the server, then sends the settlement itself.
 *
 * The server signs but does not submit, so the fee falls on the player. The attestation is
 * single-use — the round's ACTIVE→FINISHED transition enforces that on-chain — so a failed
 * send cannot be replayed into a second, better result.
 */
export async function selfSubmitRound(opts: {
  roundId: bigint;
  words: string[];
  username: string;
  feeCurrency: `0x${string}`;
}): Promise<SelfSettleResult> {
  const res = await fetch("/api/round/attest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roundId: opts.roundId.toString(), words: opts.words,
      playToken: getPlayToken(), username: opts.username,
    }),
  });
  const att = await res.json();
  if (!res.ok) throw new Error(att.error ?? "Could not score round");

  const tag = getAttributionTag();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hash = await (writeContract as any)(wagmiConfig, {
    address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "submitRound",
    args: [opts.roundId, att.score, att.wordCount, BigInt(att.deadline), att.signature],
    ...celoFee(opts.feeCurrency),
    ...(tag ? { dataSuffix: tag } : {}),
  });
  await waitForTransactionReceipt(wagmiConfig, { hash });

  return {
    score: att.score, maxScore: att.maxScore, percent: att.percent,
    words: att.words, wordCount: att.wordCount, txHash: hash,
  };
}
