import { NextRequest, NextResponse } from "next/server";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import { publicClient, relayerWallet, relayFees } from "@/lib/attestation";
import { getServerAttributionTag } from "@/lib/attribution";
import { missingConfig } from "@/lib/config";
import { scoreSubmission } from "@/lib/settle";
import { resolveDailyDate, recordDailyResult } from "@/lib/daily";
import { addWeeklyPoints } from "@/lib/weekly";

/** submitRound, including the stake transfer on the staked path. */
const SUBMIT_GAS = 350_000n;

/**
 * Settles a round and pays the network fee for it.
 *
 * For guests and signed-in players, who cannot pay for themselves: a guest has no wallet at
 * all, and a Privy embedded wallet is created empty. MiniPay players settle their own rounds
 * via /api/round/attest — Celo fees are sub-cent and payable in the stablecoin they already
 * hold, so there is nothing there worth sponsoring.
 *
 * Scoring is shared with that route, so what a round is worth never depends on who paid.
 */
export async function POST(req: NextRequest) {
  const missing = missingConfig();
  if (missing.length) {
    console.error("[config] missing", missing.join(", "));
    return NextResponse.json({ error: `Server not configured: ${missing.join(", ")}` }, { status: 503 });
  }

  let body: { roundId?: string; words?: string[]; playToken?: string; username?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (!body.roundId) return NextResponse.json({ error: "Bad round" }, { status: 400 });

  try {
    const roundId = BigInt(body.roundId);
    const submitted = Array.isArray(body.words) ? body.words.slice(0, 100) : [];
    const result = await scoreSubmission(roundId, submitted, body.playToken);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const tag = getServerAttributionTag();
    const hash = await relayerWallet().writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "submitRound",
      args: [roundId, result.score, result.words.length, result.deadline, result.signature],
      gas: SUBMIT_GAS,
      ...(await relayFees()),
      ...(tag ? { dataSuffix: tag } : {}),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") throw new Error(`submitRound reverted (${hash})`);

    // Every finished round feeds the weekly prize board, daily or not.
    await addWeeklyPoints({
      playerId: result.player,
      username: body.username ?? "Anonymous",
      points: result.score,
    });

    const dailyDate = await resolveDailyDate(roundId.toString(), result.player, result.seed);
    if (dailyDate) {
      await recordDailyResult({
        date: dailyDate, playerId: result.player, username: body.username ?? "Anonymous",
        score: result.score, maxScore: result.maxScore, wordCount: result.words.length,
      });
    }

    return NextResponse.json({
      ok: true,
      score: result.score,
      maxScore: result.maxScore,
      percent: result.percent,
      daily: dailyDate ?? null,
      words: result.words,
      wordCount: result.words.length,
      rejected: submitted.length - result.words.length,
      txHash: hash,
    });
  } catch (err) {
    console.error("[round/submit]", err);
    return NextResponse.json({ error: "Could not submit round" }, { status: 500 });
  }
}
