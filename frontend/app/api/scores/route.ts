import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getRedis } from "@/lib/redis";

/**
 * Keys are versioned: the v1 board mixed guest UUIDs in with wallet addresses, and the
 * leaderboard is now wallet-only. Starting a fresh key avoids inheriting those rows.
 */
const LB   = "lx:lb:v2";   // best single round, per wallet
const XP   = "lx:xp:v2";   // cumulative lifetime points, per wallet
const USER = (id: string) => `lx:u:v2:${id.toLowerCase()}`;
const NAME_OWNER = "lx:names:v2"; // username -> wallet, for uniqueness

// POST /api/scores — { playerId, username, score, date? }
export async function POST(req: NextRequest) {
  try {
    const { playerId, username, score, date } = await req.json() as {
      playerId: string; username: string; score: number; date?: string;
    };

    if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
      return NextResponse.json({ ok: false, error: "bad score" }, { status: 400 });
    }
    // Wallet-only board. Guests play the same game but are not ranked, so a guest UUID
    // reaching this endpoint is a bug rather than something to quietly store.
    if (!playerId || !isAddress(playerId)) {
      return NextResponse.json({ ok: false, error: "leaderboard is for signed-in players" }, { status: 403 });
    }

    const kv = getRedis();
    if (!kv) return NextResponse.json({ ok: true, stored: false });

    const id  = playerId.toLowerCase();
    const day = date ?? new Date().toISOString().slice(0, 10);
    const name = (username ?? "").trim().slice(0, 20) || "Anonymous";

    // Usernames are unique per wallet: without this two players show identically on the board.
    let safeUsername = name;
    if (name !== "Anonymous") {
      const owner = await kv.hget(NAME_OWNER, name.toLowerCase());
      if (owner && owner !== id) {
        safeUsername = `${name.slice(0, 16)}#${id.slice(2, 6)}`;
      } else if (!owner) {
        await kv.hset(NAME_OWNER, name.toLowerCase(), id);
      }
    }

    await Promise.all([
      kv.zadd(LB, "GT", score, id),
      // Mirrors the contract's totalScore. Cheap insurance: if the contract is ever
      // redeployed, ranks can be restored from here instead of resetting to zero.
      kv.zincrby(XP, score, id),
      kv.hset(USER(id), "username", safeUsername),
      kv.sadd(`lx:played:${id}`, day),
    ]);

    return NextResponse.json({ ok: true, stored: true, username: safeUsername });
  } catch (e) {
    console.error("/api/scores POST", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}

// GET /api/scores — top 20, with cumulative points so ranks match the rest of the app
export async function GET() {
  try {
    const kv = getRedis();
    if (!kv) return NextResponse.json({ scores: [] });

    const playerIds = await kv.zrevrange(LB, 0, 19);
    if (playerIds.length === 0) return NextResponse.json({ scores: [] });

    const [scoreVals, usernames, totals] = await Promise.all([
      Promise.all(playerIds.map((id) => kv.zscore(LB, id))),
      Promise.all(playerIds.map((id) => kv.hget(USER(id), "username"))),
      Promise.all(playerIds.map((id) => kv.zscore(XP, id))),
    ]);

    const scores = playerIds.map((id, i) => ({
      playerId: id,
      username: usernames[i] ?? "Anonymous",
      score: Number(scoreVals[i] ?? 0),
      points: Number(totals[i] ?? 0),
    }));

    return NextResponse.json({ scores });
  } catch (e) {
    console.error("/api/scores GET", e);
    return NextResponse.json({ scores: [] });
  }
}
