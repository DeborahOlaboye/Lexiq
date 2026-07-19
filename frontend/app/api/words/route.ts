import { NextRequest, NextResponse } from "next/server";
import rawWords from "an-array-of-english-words";

const SCORE: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 5, 6: 8, 7: 11 };

const WORDS: string[] = (rawWords as string[])
  .filter((w) => w.length >= 2 && w.length <= 7)
  .map((w) => w.toUpperCase());

function canBuild(word: string, letters: string): boolean {
  const avail: Record<string, number> = {};
  for (const c of letters) avail[c] = (avail[c] || 0) + 1;
  for (const c of word) {
    if (!avail[c]) return false;
    avail[c]--;
  }
  return true;
}

export function GET(req: NextRequest) {
  const letters = (req.nextUrl.searchParams.get("letters") ?? "").toUpperCase();
  if (letters.length !== 7) return NextResponse.json({ words: [] });

  const found = WORDS
    .filter((w) => canBuild(w, letters))
    .map((w) => ({ word: w, pts: SCORE[w.length] ?? 11 }))
    .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));

  return NextResponse.json({ words: found });
}
