import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { weekKey, weeklyLeaderboard, secondsUntilWeekEnd } from "@/lib/weekly";
import { publicClient } from "@/lib/attestation";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";

/**
 * This week's board.
 *
 * `funded` is read from the contract rather than assumed, because a prize is not guaranteed
 * every week — it depends on the pool actually being topped up. The UI shows a prize only when
 * one exists, so an unfunded week reads as a leaderboard rather than a promise we cannot keep.
 */
export async function GET() {
  const week = weekKey();
  const endsIn = secondsUntilWeekEnd();

  try {
    const [rows, pool] = await Promise.all([
      weeklyLeaderboard(week),
      publicClient.readContract({
        address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "weeklyPrizePool",
      }).catch(() => 0n),
    ]);

    const prizePool = pool as bigint;
    return NextResponse.json({
      week,
      endsIn,
      funded: prizePool > 0n,
      prizePool: formatUnits(prizePool, 18),
      rows,
    });
  } catch (err) {
    console.error("[weekly]", err);
    return NextResponse.json({ week, endsIn, funded: false, prizePool: "0", rows: [] });
  }
}
