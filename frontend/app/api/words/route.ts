import { NextRequest, NextResponse } from "next/server";
import { dictFor, usesAvailableLetters } from "@/lib/wordlist";
import { scoreWord } from "@/lib/scoring";
import type { Lang } from "@/lib/guestLetters";

/** Everything that was on the board, for the "words you missed" reveal after a round. */
export function GET(req: NextRequest) {
  const letters = (req.nextUrl.searchParams.get("letters") ?? "").toUpperCase();
  const lang    = (req.nextUrl.searchParams.get("lang") ?? "en") as Lang;
  if (letters.length !== 7) return NextResponse.json({ words: [] });

  const found = [...dictFor(lang)]
    .filter((w) => usesAvailableLetters(w, letters))
    .map((w) => ({ word: w, pts: scoreWord(w) }))
    .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));

  return NextResponse.json({ words: found });
}
