import { NextResponse } from "next/server";
import { weekKey, weeklyLeaderboard, secondsUntilWeekEnd } from "@/lib/weekly";

/**
 * This week's board.
 *
 * The prize is described by WEEKLY_PRIZE rather than read from the contract. Prizes are paid
 * off-chain and not necessarily in the token the contract holds — USDT or G$ as easily as
 * USDm — so quoting the on-chain pool would name the wrong asset, and quoting it while it sits
 * at zero would promise a prize that is not there.
 *
 * Unset means no prize this week, which is a normal state: funding is not guaranteed, and the
 * board still stands on its own as a competition.
 *
 *   WEEKLY_PRIZE="25 USDT"        -> shown as the prize
 *   WEEKLY_PRIZE="50,000 G$"      -> equally fine
 *   unset                         -> no prize claimed
 */
export async function GET() {
  const week = weekKey();
  const endsIn = secondsUntilWeekEnd();
  const prize = (process.env.WEEKLY_PRIZE ?? "").trim();

  try {
    return NextResponse.json({
      week,
      endsIn,
      funded: prize.length > 0,
      prize: prize || null,
      rows: await weeklyLeaderboard(week),
    });
  } catch (err) {
    console.error("[weekly]", err);
    return NextResponse.json({ week, endsIn, funded: false, prize: null, rows: [] });
  }
}
