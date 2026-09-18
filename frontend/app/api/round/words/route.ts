import { NextRequest, NextResponse } from "next/server";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ROUND, LANG_BY_ID } from "@/lib/contracts";
import { publicClient, lettersForRound } from "@/lib/attestation";
import { verifyPlayToken } from "@/lib/playtoken";
import { missingConfig } from "@/lib/config";
import { solveBoard } from "@/lib/wordlist";
import { opponentPlay, opponentTicks, LEVEL_NAMES } from "@/lib/opponent";
import { lockVersusLevel } from "@/lib/versusRound";
import { hashAll } from "@/lib/wordhash";
import type { Lang } from "@/lib/guestLetters";

/** Mirrors roundDuration() in Lexiq.sol, so the pacing matches the clock the player sees. */
const ROUND_SECONDS: Record<number, number> = { 0: 120, 1: 90, 2: 60 };

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

  let body: { roundId?: string; playToken?: string; vsLevel?: number };
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
    // The agent's target, known from the seed before the player starts. Sending it up front is
    // what turns "you lost to a bot" on the results screen into a race you can see while you
    // play — and it is safe to reveal, because its words were fixed when the round opened.
    // The opponent the player asked for, fixed on the first load of this board.
    const level = await lockVersusLevel(
      body.roundId, body.vsLevel, Number(round[ROUND.difficulty]),
    );
    const play = opponentPlay({ seed: String(round[ROUND.seed]), letters, lang, level });

    return NextResponse.json({
      letters,
      wordHashes: hashAll(solveBoard(letters, lang).map((w) => w.word)),
      agent: {
        score: play.score,
        level: play.level,
        name: LEVEL_NAMES[play.level] ?? "Sharp",
        // Running totals only — never the words, which would be the answer key.
        ticks: opponentTicks(play, ROUND_SECONDS[Number(round[ROUND.difficulty])] ?? 90, String(round[ROUND.seed])),
      },
    });
  } catch (err) {
    console.error("[round/words]", err);
    return NextResponse.json({ error: "Could not load board" }, { status: 500 });
  }
}
