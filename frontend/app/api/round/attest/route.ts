import { NextRequest, NextResponse } from "next/server";
import { missingConfig } from "@/lib/config";
import { scoreSubmission } from "@/lib/settle";
import { resolveDailyDate, recordDailyResult } from "@/lib/daily";
import { addWeeklyPoints } from "@/lib/weekly";
import { recordMatchScore } from "@/lib/match";

/**
 * Scores a round and returns the signed attestation without sending anything.
 *
 * For MiniPay players, who settle their own rounds. Celo fees are sub-cent and payable in the
 * stablecoin they already hold, so there is nothing to sponsor — and sponsoring would mean
 * carrying the cost of the traffic we most expect. Guests and signed-in players still go
 * through /api/round/submit, which relays: a guest has no wallet at all, and a Privy embedded
 * wallet is created empty, so neither can pay for anything.
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

    // Recorded here rather than after the transaction lands: the player sends it themselves,
    // so we never see the receipt. The attestation is single-use — the round's ACTIVE→FINISHED
    // transition enforces that on-chain — so this cannot be replayed for a better placing.
    await recordMatchScore(roundId.toString(), result.player, result.score);

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
      words: result.words,
      wordCount: result.words.length,
      rejected: submitted.length - result.words.length,
      daily: dailyDate ?? null,
      // What the player needs to call submitRound themselves.
      deadline: result.deadline.toString(),
      signature: result.signature,
    });
  } catch (err) {
    console.error("[round/attest]", err);
    return NextResponse.json({ error: "Could not score round" }, { status: 500 });
  }
}
