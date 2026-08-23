import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

// POST /api/scores
// Body: { playerId, username, score, date? }
export async function POST(req: NextRequest) {
  try {
    const { playerId, username, score, date } = await req.json() as {
      playerId: string; username: string; score: number; date?: string;
    };
    if (!playerId || typeof score !== "number") {
      return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    }

    const kv = getRedis();
    if (!kv) return NextResponse.json({ ok: true, stored: false });

    const day = date ?? new Date().toISOString().slice(0, 10);
    const safeUsername = (username ?? "").trim().slice(0, 20) || "Anonymous";

    await Promise.all([
      kv.zadd("lx:lb", "GT", score, playerId),
      kv.hset(`lx:u:${playerId}`, "username", safeUsername),
      kv.sadd(`lx:played:${playerId}`, day),
    ]);

    return NextResponse.json({ ok: true, stored: true });
  } catch (e) {
    console.error("/api/scores POST", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}

// GET /api/scores — top 20 leaderboard
export async function GET() {
  try {
    const kv = getRedis();
    if (!kv) return NextResponse.json({ scores: [] });

    const playerIds = await kv.zrevrange("lx:lb", 0, 19);
    if (playerIds.length === 0) return NextResponse.json({ scores: [] });

    const [scoreVals, usernames] = await Promise.all([
      Promise.all(playerIds.map((id) => kv.zscore("lx:lb", id))),
      Promise.all(playerIds.map((id) => kv.hget(`lx:u:${id}`, "username"))),
    ]);

    const scores = playerIds.map((id, i) => ({
      playerId: id,
      username: usernames[i] ?? "Anonymous",
      score: Number(scoreVals[i] ?? 0),
    }));

    return NextResponse.json({ scores });
  } catch (e) {
    console.error("/api/scores GET", e);
    return NextResponse.json({ scores: [] });
  }
}
