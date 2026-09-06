import { NextRequest, NextResponse } from "next/server";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ROUND, LANG_BY_ID } from "@/lib/contracts";
import { publicClient, lettersForRound } from "@/lib/attestation";
import { verifyPlayToken } from "@/lib/playtoken";
import { missingConfig } from "@/lib/config";
import { solveBoard } from "@/lib/wordlist";
import { hashAll } from "@/lib/wordhash";
import type { Lang } from "@/lib/guestLetters";

/**
 * Word hashes for a round already in progress — a staked round the player sent themselves, or
 * a page reloaded mid-game. Both otherwise fall back to asking the server about every word,
 * which is a round trip each and unusable on a slow connection.
 *
 * Gated on the play token: these are hashes rather than words, but there is no reason to serve
 * a board's answer set to anyone but the player sitting in front of it.
 */
export async function POST(req: NextRequest) {
  if (missingConfig().length) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: { roundId?: string; playToken?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (!body.roundId) return NextResponse.json({ error: "Bad round" }, { status: 400 });

  try {
    const roundId = BigInt(body.roundId);

    // A round mined a moment ago may not be on the node this read lands on yet, and getRound
    // answers for an unknown round with a zeroed struct rather than reverting — so without
    // this the player field is the zero address and their own round is refused as not theirs.
    let round: readonly unknown[] = [];
    let player = "0x0000000000000000000000000000000000000000" as `0x${string}`;
    for (let i = 0; i < 8; i++) {
      round = await publicClient.readContract({
        address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getRound", args: [roundId],
      }) as readonly unknown[];
      player = round[ROUND.player] as `0x${string}`;
      if (Number(round[ROUND.startedAt]) > 0) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (Number(round[ROUND.startedAt]) === 0) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }
    if (!verifyPlayToken(body.playToken, player)) {
      return NextResponse.json({ error: "Not your round" }, { status: 403 });
    }

    const lang: Lang = LANG_BY_ID[Number(round[ROUND.lang])] ?? "en";
    const letters = await lettersForRound(roundId, player);

    // The letters go back too. The board used to read these from chain in the browser, where
    // an unknown round hands back plausible but wrong letters that never get corrected — a
    // player then builds words the server cannot score and the round settles at zero.
    return NextResponse.json({
      letters,
      wordHashes: hashAll(solveBoard(letters, lang).map((w) => w.word)),
    });
  } catch (err) {
    console.error("[round/words]", err);
    return NextResponse.json({ error: "Could not load board" }, { status: 500 });
  }
}
