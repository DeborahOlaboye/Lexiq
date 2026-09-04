import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { todayKey, dailyDifficulty, dailyLeaderboard, hasPlayedToday } from "@/lib/daily";

const DIFFICULTY_LABEL = ["Easy", "Normal", "Hard"];
const DIFFICULTY_SECONDS = [120, 90, 60];

/**
 * Today's challenge: the settings everyone shares, the board so far, and whether this player
 * has already used their attempt.
 *
 * Wallet players only, matching the main leaderboard — signing in is what puts you on a board.
 */
export async function GET(req: NextRequest) {
  const date = todayKey();
  const difficulty = dailyDifficulty(date);
  const player = req.nextUrl.searchParams.get("player") ?? "";

  try {
    const [rows, played] = await Promise.all([
      dailyLeaderboard(date),
      isAddress(player) ? hasPlayedToday(player, date) : Promise.resolve(false),
    ]);

    return NextResponse.json({
      date,
      difficulty,
      difficultyLabel: DIFFICULTY_LABEL[difficulty],
      seconds: DIFFICULTY_SECONDS[difficulty],
      alreadyPlayed: played,
      rows,
    });
  } catch (err) {
    console.error("[daily]", err);
    return NextResponse.json({ date, difficulty, rows: [], alreadyPlayed: false });
  }
}
