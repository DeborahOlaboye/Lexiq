import { NextRequest, NextResponse } from "next/server";

// ── KV client (graceful fallback if KV not configured) ─────────────────────

async function getKV() {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const { createClient } = await import("@vercel/kv");
  return createClient({ url, token });
}

// ── POST /api/scores ────────────────────────────────────────────────────────
// Body: { playerId, username, score, date? }
// Records or updates the player's best score and logs the play date.

export async function POST(req: NextRequest) {
  try {
    const { playerId, username, score, date } = await req.json() as {
      playerId: string; username: string; score: number; date?: string;
    };
    if (!playerId || typeof score !== "number") {
      return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    }

    const kv = await getKV();
    if (!kv) return NextResponse.json({ ok: true, stored: false });

    const day = date ?? new Date().toISOString().slice(0, 10);
    const safeUsername = (username ?? "").trim().slice(0, 20) || "Anonymous";

    await Promise.all([
      // Only update the leaderboard score if the new score is higher
      kv.zadd("lx:lb", { gt: true }, { score, member: playerId }),
      // Persist username
      kv.hset(`lx:u:${playerId}`, { username: safeUsername }),
      // Record the calendar day they played
      kv.sadd(`lx:played:${playerId}`, day),
    ]);

    return NextResponse.json({ ok: true, stored: true });
  } catch (e) {
    console.error("/api/scores POST", e);
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}

// ── GET /api/scores ─────────────────────────────────────────────────────────
// Returns the top 20 players from the KV leaderboard.
// Falls back to empty array if KV is not configured.

export async function GET() {
  try {
    const kv = await getKV();
    if (!kv) return NextResponse.json({ scores: [] });

    // Fetch top 20 playerIds with their scores (highest first)
    const raw = await kv.zrange<string[]>("lx:lb", 0, 19, { rev: true, withScores: true });

    // raw is [member, score, member, score, ...] interleaved
    const entries: { playerId: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ playerId: raw[i] as unknown as string, score: Number(raw[i + 1]) });
    }

    if (entries.length === 0) return NextResponse.json({ scores: [] });

    // Batch-fetch usernames
    const usernames = await Promise.all(
      entries.map((e) => kv.hget<string>(`lx:u:${e.playerId}`, "username"))
    );

    const scores = entries.map((e, i) => ({
      playerId: e.playerId,
      username: usernames[i] ?? "Anonymous",
      score: e.score,
    }));

    return NextResponse.json({ scores });
  } catch (e) {
    console.error("/api/scores GET", e);
    return NextResponse.json({ scores: [] });
  }
}
