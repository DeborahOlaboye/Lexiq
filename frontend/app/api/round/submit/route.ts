import { NextRequest, NextResponse } from "next/server";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ROUND, ROUND_ACTIVE } from "@/lib/contracts";
import { FEE_CURRENCY } from "@/lib/minipay";
import { publicClient, relayerWallet, signScore, relayFees, nowSeconds } from "@/lib/attestation";
import { getServerAttributionTag } from "@/lib/attribution";
import { acceptWords } from "@/lib/wordlist";
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
  let body: { roundId?: string; words?: string[]; lang?: Lang };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  if (!body.roundId) return NextResponse.json({ error: "Bad round" }, { status: 400 });
  const roundId = BigInt(body.roundId);
  const lang: Lang = (["en", "es", "fr"].includes(body.lang ?? "") ? body.lang : "en") as Lang;
  const submitted = Array.isArray(body.words) ? body.words.slice(0, 100) : [];

  try {
    const round = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getRound", args: [roundId],
    }) as readonly unknown[];

    const player     = round[ROUND.player] as `0x${string}`;
    const startedAt  = Number(round[ROUND.startedAt]);
    const difficulty = Number(round[ROUND.difficulty]);
    const state      = Number(round[ROUND.state]);

    if (state !== ROUND_ACTIVE) {
      return NextResponse.json({ error: "Round already finished" }, { status: 409 });
    }

    const limit = (DURATION[difficulty] ?? 90) + GRACE_SECONDS;
    if (nowSeconds() - startedAt > limit) {
      return NextResponse.json({ error: "Round expired" }, { status: 410 });
    }

    const rawLetters = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getLetters", args: [roundId],
    }) as readonly `0x${string}`[];
    const letters = rawLetters
      .map((b) => String.fromCharCode(parseInt(b.slice(2), 16)))
      .join("");

    const accepted = acceptWords(submitted, letters, lang, MAX_WORDS);
    const score = scoreWords(accepted);

    const { deadline, signature } = await signScore(roundId, player, score, accepted.length);

    const tag = getServerAttributionTag();
    const hash = await relayerWallet().writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "submitRound",
      args: [roundId, score, accepted.length, deadline, signature],
      gas: SUBMIT_GAS,
      ...(await relayFees(FEE_CURRENCY)),
      ...(tag ? { dataSuffix: tag } : {}),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") throw new Error(`submitRound reverted (${hash})`);

    return NextResponse.json({
      ok: true,
      score,
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
