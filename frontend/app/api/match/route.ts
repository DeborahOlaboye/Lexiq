import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { missingConfig } from "@/lib/config";
import { joinQueue, leaveQueue, matchForPlayer, outcomeFor } from "@/lib/match";
import { LANG_ID } from "@/lib/contracts";
import type { Lang } from "@/lib/guestLetters";

/**
 * Head-to-head matchmaking, for wallet players only — guests have no standing on any board,
 * so there would be nothing to win.
 *
 * POST joins the queue and returns a match once one is made. GET reports where an existing
 * match has got to, including who won.
 */
export async function POST(req: NextRequest) {
  if (missingConfig().length) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  let body: { address?: string; username?: string; difficulty?: number; lang?: Lang; cancel?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const address = body.address ?? "";
  if (!isAddress(address)) return NextResponse.json({ error: "Sign in to play head-to-head" }, { status: 403 });

  const difficulty = [0, 1, 2].includes(body.difficulty ?? -1) ? body.difficulty! : 1;
  const lang: Lang = (["en", "es", "fr"].includes(body.lang ?? "") ? body.lang : "en") as Lang;
  const username = (body.username ?? "Anonymous").slice(0, 20);

  try {
    if (body.cancel) {
      await leaveQueue(address, difficulty, lang, username);
      return NextResponse.json({ status: "cancelled" });
    }
    const match = await joinQueue({ address, username, difficulty, lang });
    if (!match) return NextResponse.json({ status: "waiting" });

    const opponent = match.players.find((p) => p.address !== address.toLowerCase());
    return NextResponse.json({
      status: "matched",
      matchId: match.id,
      difficulty: match.difficulty,
      lang: match.lang,
      opponent: opponent?.username ?? "Anonymous",
    });
  } catch (err) {
    console.error("[match] POST", err);
    return NextResponse.json({ error: "Matchmaking unavailable" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!isAddress(address)) return NextResponse.json({ state: "waiting" });
  try {
    const match = await matchForPlayer(address);
    if (!match) return NextResponse.json({ state: "waiting" });
    return NextResponse.json({ matchId: match.id, ...outcomeFor(match, address) });
  } catch (err) {
    console.error("[match] GET", err);
    return NextResponse.json({ state: "waiting" });
  }
}
