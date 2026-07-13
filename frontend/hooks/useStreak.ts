"use client";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import { useMemo } from "react";

function startOfDayUTC(ts: number) {
  const d = new Date(ts * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
}

export function useStreak() {
  const { address } = useAccount();

  const { data: roundIds } = useReadContract({
    address: LEXIQ_ADDRESS,
    abi: LEXIQ_ABI,
    functionName: "getPlayerRounds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Batch-read all round timestamps
  const contracts = useMemo(() => {
    if (!roundIds) return [];
    return (roundIds as bigint[]).map((id) => ({
      address: LEXIQ_ADDRESS as `0x${string}`,
      abi: LEXIQ_ABI,
      functionName: "getRound" as const,
      args: [id] as const,
    }));
  }, [roundIds]);

  const { data: roundData } = useReadContracts({ contracts, query: { enabled: contracts.length > 0 } });

  const { streak, longestStreak, lastPlayedToday } = useMemo(() => {
    if (!roundData || roundData.length === 0) return { streak: 0, longestStreak: 0, lastPlayedToday: false };

    // Collect unique play-days (UTC) from finished rounds
    const days = new Set<number>();
    for (const r of roundData) {
      if (r.status === "success" && r.result) {
        const startedAt = (r.result as unknown as [unknown, unknown, number])[2];
        if (startedAt) days.add(startOfDayUTC(startedAt));
      }
    }

    const sorted = Array.from(days).sort((a, b) => b - a); // newest first
    if (sorted.length === 0) return { streak: 0, longestStreak: 0, lastPlayedToday: false };

    const todayStart = startOfDayUTC(Math.floor(Date.now() / 1000));
    const DAY = 86400;

    // Current streak: consecutive days counting back from today or yesterday
    let streak = 0;
    let expected = todayStart;
    // allow today or yesterday as start
    if (sorted[0] === todayStart || sorted[0] === todayStart - DAY) {
      expected = sorted[0];
      for (const day of sorted) {
        if (day === expected) { streak++; expected -= DAY; }
        else if (day < expected) break;
      }
    }

    // Longest streak ever
    let longest = 0, run = 0, prev: number | null = null;
    for (const day of [...sorted].reverse()) {
      if (prev === null || day === prev + DAY) { run++; }
      else if (day > prev + DAY) { run = 1; }
      if (run > longest) longest = run;
      prev = day;
    }

    return { streak, longestStreak: longest, lastPlayedToday: sorted[0] === todayStart };
  }, [roundData]);

  return { streak, longestStreak, lastPlayedToday };
}
