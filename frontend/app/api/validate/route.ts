import { NextRequest, NextResponse } from "next/server";
import { isWord } from "@/lib/wordlist";
import type { Lang } from "@/lib/guestLetters";

/**
 * Live check as a player types. Shares the dictionary with the scoring path so the board can
 * never accept a word the server would later refuse — including the minimum word length.
 */
export function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("w");
  const lang = (req.nextUrl.searchParams.get("lang") ?? "en") as Lang;
  if (!word) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: isWord(word, lang) });
}
