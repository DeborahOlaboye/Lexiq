import { NextRequest, NextResponse } from "next/server";
import rawWords from "an-array-of-english-words";

const WORDS: Set<string> = new Set(
  (rawWords as string[])
    .filter((w) => w.length >= 2 && w.length <= 7)
    .map((w) => w.toUpperCase())
);

export function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("w");
  if (!word) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: WORDS.has(word.toUpperCase()) });
}
