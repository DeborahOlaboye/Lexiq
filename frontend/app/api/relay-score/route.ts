import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import { FEE_CURRENCY } from "@/lib/minipay";
import {
  publicClient, relayerWallet, relayerAccount, signSeed, signScore, relayFees,
} from "@/lib/attestation";
import { getServerAttributionTag } from "@/lib/attribution";
import { acceptWords } from "@/lib/wordlist";
import { scoreWords, MAX_WORDS } from "@/lib/scoring";
import type { Lang } from "@/lib/guestLetters";

const START_GAS  = 300_000n;
const SUBMIT_GAS = 250_000n;

/**
 * Guest rounds. A guest has no wallet, so the relayer plays as itself — these rounds carry
 * no stake and never reach the leaderboard, which is wallet-only. They still settle on-chain
 * so guest play counts toward the app's attributed transaction volume.
 */
export async function POST(req: NextRequest) {
  let body: { words?: string[]; difficulty?: number; lang?: Lang };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const difficulty = [0, 1, 2].includes(body.difficulty ?? -1) ? body.difficulty! : 1;
  const lang: Lang = (["en", "es", "fr"].includes(body.lang ?? "") ? body.lang : "en") as Lang;
  const submitted = Array.isArray(body.words) ? body.words.slice(0, 100) : [];
  if (submitted.length === 0) return NextResponse.json({ error: "No words" }, { status: 400 });

  try {
    const player = relayerAccount().address;
    const wallet = relayerWallet();
    const tag = getServerAttributionTag();
    const suffix = tag ? { dataSuffix: tag } : {};

    // 1. Open the round so its letters are fixed on-chain before they are scored.
    const nonce = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "roundNonce", args: [player],
    });
    const seed = await signSeed(player, nonce as bigint, difficulty);

    const startHash = await wallet.writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "startRoundFor",
      args: [player, difficulty, seed.seed, seed.deadline, seed.signature],
      gas: START_GAS, ...(await relayFees(FEE_CURRENCY)), ...suffix,
    });
    const startReceipt = await publicClient.waitForTransactionReceipt({ hash: startHash });
    if (startReceipt.status === "reverted") throw new Error(`startRoundFor reverted (${startHash})`);

    let roundId: bigint | null = null;
    for (const log of startReceipt.logs) {
      if (log.address.toLowerCase() !== LEXIQ_ADDRESS.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: LEXIQ_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === "RoundStarted") {
          roundId = (ev.args as unknown as { roundId: bigint }).roundId;
          break;
        }
      } catch { /* not our event */ }
    }
    if (roundId === null) throw new Error("RoundStarted not found in receipt");

    // 2. Dictionary only — see acceptWords: a guest's letters are generated in the browser
    //    and will not match the ones this round drew on-chain.
    const accepted = acceptWords(submitted, null, lang, MAX_WORDS);
    const score = scoreWords(accepted);
    const attestation = await signScore(roundId, player, score, accepted.length);

    const submitHash = await wallet.writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "submitRound",
      args: [roundId, score, accepted.length, attestation.deadline, attestation.signature],
      gas: SUBMIT_GAS, ...(await relayFees(FEE_CURRENCY)), ...suffix,
    });
    const submitReceipt = await publicClient.waitForTransactionReceipt({ hash: submitHash });
    if (submitReceipt.status === "reverted") throw new Error(`submitRound reverted (${submitHash})`);

    return NextResponse.json({
      ok: true,
      roundId: roundId.toString(),
      score,
      wordCount: accepted.length,
      txHash: submitHash,
    });
  } catch (err) {
    console.error("[relay-score]", err);
    return NextResponse.json({ error: "Relay failed" }, { status: 500 });
  }
}
