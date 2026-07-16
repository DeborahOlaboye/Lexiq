import { NextRequest, NextResponse } from "next/server";

async function getKV() {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const { createClient } = await import("@vercel/kv");
  return createClient({ url, token });
}

function computeStreak(dates: string[]): { streak: number; longestStreak: number; lastPlayedToday: boolean } {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

  const sorted = [...new Set(dates)].sort().reverse(); // newest first
  if (sorted.length === 0) return { streak: 0, longestStreak: 0, lastPlayedToday: false };

  const lastPlayedToday = sorted[0] === today;

  // Current streak — must start today or yesterday
  let streak = 0;
  if (sorted[0] === today || sorted[0] === yesterday) {
    streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 864e5);
      if (diffDays === 1) streak++;
      else break;
    }
  }

  // Longest ever streak
  let longest = 1, cur = 1;
  const asc = [...sorted].reverse(); // oldest first
  for (let i = 1; i < asc.length; i++) {
    const prev = new Date(asc[i - 1]);
    const curr = new Date(asc[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 864e5);
    if (diffDays === 1) { cur++; longest = Math.max(longest, cur); }
    else cur = 1;
  }

  return { streak, longestStreak: Math.max(longest, streak), lastPlayedToday };
}

// GET /api/streak?pid={playerId}
export async function GET(req: NextRequest) {
  const pid = req.nextUrl.searchParams.get("pid");
  if (!pid) return NextResponse.json({ streak: 0, longestStreak: 0, lastPlayedToday: false });

  try {
    const kv = await getKV();
    if (!kv) return NextResponse.json({ streak: 0, longestStreak: 0, lastPlayedToday: false });

    const dates = await kv.smembers<string[]>(`lx:played:${pid}`);
    return NextResponse.json(computeStreak(dates ?? []));
  } catch (e) {
    console.error("/api/streak GET", e);
    return NextResponse.json({ streak: 0, longestStreak: 0, lastPlayedToday: false });
  }
}
