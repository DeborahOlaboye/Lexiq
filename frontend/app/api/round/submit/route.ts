import { NextRequest, NextResponse } from "next/server";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ROUND, ROUND_ACTIVE, LANG_BY_ID } from "@/lib/contracts";
import { publicClient, relayerWallet, signScore, relayFees, nowSeconds, lettersForRound } from "@/lib/attestation";
import { getServerAttributionTag } from "@/lib/attribution";
import { missingConfig } from "@/lib/config";
import { verifyPlayToken } from "@/lib/playtoken";
import { acceptWords, boardMaxScore } from "@/lib/wordlist";
import { dailyDateForRound, recordDailyResult } from "@/lib/daily";
import { scoreWords, MAX_WORDS } from "@/lib/scoring";
import type { Lang } from "@/lib/guestLetters";

/** submitRound, including the stake transfer on the staked path. */
const SUBMIT_GAS = 350_000n;

/**
 * Wall-clock slack on top of the round length, covering typing the last word, request
 * latency and a slow connection. The clock is enforced here rather than by block.timestamp
 * so a transaction landing a second late never costs an honest player their stake.
 */
const GRACE_SECONDS = 30;

const DURATION: Record<number, number> = { 0: 120, 1: 90, 2: 60 };

export async function POST(req: NextRequest) {
  let body: { roundId?: string; words?: string[]; playToken?: string; username?: string };
  const missing = missingConfig();
  if (missing.length) {
    console.error("[config] missing", missing.join(", "));
    return NextResponse.json({ error: `Server not configured: ${missing.join(", ")}` }, { status: 503 });
  }

  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  if (!body.roundId) return NextResponse.json({ error: "Bad round" }, { status: 400 });
  const roundId = BigInt(body.roundId);
  const submitted = Array.isArray(body.words) ? body.words.slice(0, 100) : [];

  try {
    const round = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getRound", args: [roundId],
    }) as readonly unknown[];

    const player     = round[ROUND.player] as `0x${string}`;
    const startedAt  = Number(round[ROUND.startedAt]);
    const difficulty = Number(round[ROUND.difficulty]);
    const state      = Number(round[ROUND.state]);
    // Read from the round, never the request: a player could otherwise open a round on the
    // French table — which is heavily weighted to E — and settle it against the English
    // dictionary, pairing a favourable draw with a different word list.
    const lang: Lang = LANG_BY_ID[Number(round[ROUND.lang])] ?? "en";

    if (state !== ROUND_ACTIVE) {
      return NextResponse.json({ error: "Round already finished" }, { status: 409 });
    }

    // RoundStarted is a public event, so without this anyone watching the chain could settle
    // a stranger's active round with no words and forfeit their stake.
    if (!verifyPlayToken(body.playToken, player)) {
      return NextResponse.json({ error: "Not your round" }, { status: 403 });
    }

    const limit = (DURATION[difficulty] ?? 90) + GRACE_SECONDS;
    if (nowSeconds() - startedAt > limit) {
      return NextResponse.json({ error: "Round expired" }, { status: 410 });
    }

    const letters = await lettersForRound(roundId, player);

    const accepted = acceptWords(submitted, letters, lang, MAX_WORDS);
    const score = scoreWords(accepted);

    const { deadline, signature } = await signScore(roundId, player, score, accepted.length);

    const tag = getServerAttributionTag();
    const hash = await relayerWallet().writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "submitRound",
      args: [roundId, score, accepted.length, deadline, signature],
      gas: SUBMIT_GAS,
      ...(await relayFees()),
      ...(tag ? { dataSuffix: tag } : {}),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") throw new Error(`submitRound reverted (${hash})`);

    // Ranked on the share of the board found, so a generous draw is worth no more than a
    // barren one — which is what makes separate boards comparable at all.
    const maxScore = boardMaxScore(letters, lang);
    const percent = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;

    const dailyDate = await dailyDateForRound(roundId.toString());
    if (dailyDate) {
      await recordDailyResult({
        date: dailyDate, playerId: player, username: body.username ?? "Anonymous",
        score, maxScore, wordCount: accepted.length,
      });
    }

    return NextResponse.json({
      ok: true,
      score,
      maxScore,
      percent,
      daily: dailyDate ?? null,
      words: accepted,
      wordCount: accepted.length,
      rejected: submitted.length - accepted.length,
      txHash: hash,
    });
  } catch (err) {
    console.error("[round/submit]", err);
    return NextResponse.json({ error: "Could not submit round" }, { status: 500 });
  }
}
