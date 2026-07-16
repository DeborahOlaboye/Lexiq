"use client";
import { useEffect, useState } from "react";

type StreakData = { streak: number; longestStreak: number; lastPlayedToday: boolean };

const EMPTY: StreakData = { streak: 0, longestStreak: 0, lastPlayedToday: false };

export function usePlayerStreak(playerId: string | undefined): StreakData {
  const [data, setData] = useState<StreakData>(EMPTY);

  useEffect(() => {
    if (!playerId) { setData(EMPTY); return; }
    let cancelled = false;
    fetch(`/api/streak?pid=${encodeURIComponent(playerId)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [playerId]);

  return data;
}

/** Fire-and-forget: submit a score + record today as played. */
export async function submitScore(opts: {
  playerId: string;
  username: string;
  score: number;
}): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await fetch("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...opts, date }),
  }).catch(() => {});
}
