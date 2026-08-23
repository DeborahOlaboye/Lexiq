import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

const QUEUE_KEY = "lx:mmq";
const STALE_MS  = 35_000;

// POST /api/matchmaking  { playerId, username }
export async function POST(req: NextRequest) {
  try {
    const { playerId, username } = await req.json() as { playerId: string; username: string };
    if (!playerId) return NextResponse.json({ status: "error" }, { status: 400 });

    const kv = getRedis();
    if (!kv) return NextResponse.json({ status: "no-kv" });

    const now  = Date.now();
    const safe = (username ?? "").trim().slice(0, 20) || "Anonymous";

    await kv.set(`lx:mmu:${playerId}`, safe, "EX", 120);
    await Promise.all([
      kv.zrem(QUEUE_KEY, playerId),
      kv.del(`lx:mmatch:${playerId}`),
    ]);

    const waiting = await kv.zrangebyscore(QUEUE_KEY, now - STALE_MS, "+inf");
    const candidates = waiting.filter(id => id !== playerId);

    if (candidates.length > 0) {
      const opponentId       = candidates[0];
      const opponentUsername = (await kv.get(`lx:mmu:${opponentId}`)) ?? "Anonymous";

      await Promise.all([
        kv.zrem(QUEUE_KEY, opponentId),
        kv.set(`lx:mmatch:${playerId}`, JSON.stringify({ opponentId, opponentUsername }), "EX", 300),
        kv.set(`lx:mmatch:${opponentId}`, JSON.stringify({ opponentId: playerId, opponentUsername: safe }), "EX", 300),
      ]);

      return NextResponse.json({ status: "matched", opponent: { id: opponentId, username: opponentUsername } });
    }

    await kv.zadd(QUEUE_KEY, now, playerId);
    return NextResponse.json({ status: "waiting" });
  } catch (e) {
    console.error("/api/matchmaking POST", e);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// GET /api/matchmaking?playerId=xxx
export async function GET(req: NextRequest) {
  try {
    const playerId = req.nextUrl.searchParams.get("playerId");
    if (!playerId) return NextResponse.json({ status: "error" }, { status: 400 });

    const kv = getRedis();
    if (!kv) return NextResponse.json({ status: "no-kv" });

    const matchStr = await kv.get(`lx:mmatch:${playerId}`);
    if (matchStr) {
      const { opponentId, opponentUsername } = JSON.parse(matchStr);
      return NextResponse.json({ status: "matched", opponent: { id: opponentId, username: opponentUsername } });
    }

    const score = await kv.zscore(QUEUE_KEY, playerId);
    if (score !== null && Date.now() - Number(score) < STALE_MS) {
      return NextResponse.json({ status: "waiting" });
    }

    return NextResponse.json({ status: "expired" });
  } catch (e) {
    console.error("/api/matchmaking GET", e);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// DELETE /api/matchmaking?playerId=xxx
export async function DELETE(req: NextRequest) {
  try {
    const playerId = req.nextUrl.searchParams.get("playerId");
    if (!playerId) return NextResponse.json({ ok: false }, { status: 400 });

    const kv = getRedis();
    if (kv) {
      await Promise.all([
        kv.zrem(QUEUE_KEY, playerId),
        kv.del(`lx:mmu:${playerId}`),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/matchmaking DELETE", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
