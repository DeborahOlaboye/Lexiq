import { NextRequest, NextResponse } from "next/server";

const QUEUE_KEY = "lx:mmq";
const STALE_MS  = 35_000; // players older than 35s are considered gone

async function getKV() {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const { createClient } = await import("@vercel/kv");
  return createClient({ url, token });
}

// POST /api/matchmaking
// Body: { playerId, username }
// Response: { status: "matched", opponent: { id, username } }
//         | { status: "waiting" }
//         | { status: "no-kv" }
export async function POST(req: NextRequest) {
  try {
    const { playerId, username } = await req.json() as { playerId: string; username: string };
    if (!playerId) return NextResponse.json({ status: "error" }, { status: 400 });

    const kv = await getKV();
    if (!kv) return NextResponse.json({ status: "no-kv" });

    const now  = Date.now();
    const safe = (username ?? "").trim().slice(0, 20) || "Anonymous";

    // Store username lookup (TTL 2 min)
    await kv.set(`lx:mmu:${playerId}`, safe, { ex: 120 });

    // Remove self from queue (re-join is idempotent) and clear any stale match slot
    await Promise.all([
      kv.zrem(QUEUE_KEY, playerId),
      kv.del(`lx:mmatch:${playerId}`),
    ]);

    // Find all non-stale players waiting (score = join timestamp)
    const waiting = await kv.zrange<string[]>(QUEUE_KEY, now - STALE_MS, "+inf", { byScore: true });
    const candidates = waiting.filter(id => id !== playerId);

    if (candidates.length > 0) {
      // Pick the oldest waiter (lowest score = joined first)
      const opponentId       = candidates[0];
      const opponentUsername = (await kv.get<string>(`lx:mmu:${opponentId}`)) ?? "Anonymous";

      // Remove opponent from queue and record the match for both players
      await Promise.all([
        kv.zrem(QUEUE_KEY, opponentId),
        kv.set(
          `lx:mmatch:${playerId}`,
          JSON.stringify({ opponentId, opponentUsername }),
          { ex: 300 }
        ),
        kv.set(
          `lx:mmatch:${opponentId}`,
          JSON.stringify({ opponentId: playerId, opponentUsername: safe }),
          { ex: 300 }
        ),
      ]);

      return NextResponse.json({
        status:   "matched",
        opponent: { id: opponentId, username: opponentUsername },
      });
    }

    // No one waiting — join the queue
    await kv.zadd(QUEUE_KEY, { score: now, member: playerId });

    return NextResponse.json({ status: "waiting" });
  } catch (e) {
    console.error("/api/matchmaking POST", e);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// GET /api/matchmaking?playerId=xxx
// Poll for match status.
// Response: { status: "matched", opponent: { id, username } }
//         | { status: "waiting" }
//         | { status: "expired" }
export async function GET(req: NextRequest) {
  try {
    const playerId = req.nextUrl.searchParams.get("playerId");
    if (!playerId) return NextResponse.json({ status: "error" }, { status: 400 });

    const kv = await getKV();
    if (!kv) return NextResponse.json({ status: "no-kv" });

    // Check if already matched
    const matchStr = await kv.get<string>(`lx:mmatch:${playerId}`);
    if (matchStr) {
      const { opponentId, opponentUsername } = JSON.parse(matchStr) as {
        opponentId: string;
        opponentUsername: string;
      };
      return NextResponse.json({
        status:   "matched",
        opponent: { id: opponentId, username: opponentUsername },
      });
    }

    // Check if still live in queue
    const score = await kv.zscore(QUEUE_KEY, playerId);
    if (score !== null && Date.now() - score < STALE_MS) {
      return NextResponse.json({ status: "waiting" });
    }

    return NextResponse.json({ status: "expired" });
  } catch (e) {
    console.error("/api/matchmaking GET", e);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// DELETE /api/matchmaking?playerId=xxx
// Leave the queue (cancel).
export async function DELETE(req: NextRequest) {
  try {
    const playerId = req.nextUrl.searchParams.get("playerId");
    if (!playerId) return NextResponse.json({ ok: false }, { status: 400 });

    const kv = await getKV();
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
