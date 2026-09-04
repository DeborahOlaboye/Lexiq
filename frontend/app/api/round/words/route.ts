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
    const round = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getRound", args: [roundId],
    }) as readonly unknown[];

    const player = round[ROUND.player] as `0x${string}`;
    if (!verifyPlayToken(body.playToken, player)) {
      return NextResponse.json({ error: "Not your round" }, { status: 403 });
    }

    const lang: Lang = LANG_BY_ID[Number(round[ROUND.lang])] ?? "en";
    const letters = await lettersForRound(roundId, player);

    return NextResponse.json({ wordHashes: hashAll(solveBoard(letters, lang).map((w) => w.word)) });
  } catch (err) {
    console.error("[round/words]", err);
    return NextResponse.json({ error: "Could not load board" }, { status: 500 });
  }
}
