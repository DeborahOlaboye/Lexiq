import { NextRequest, NextResponse } from "next/server";
import rawEn from "an-array-of-english-words";
import rawEs from "an-array-of-spanish-words";
import rawFr from "an-array-of-french-words";

const SCORE: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 5, 6: 8, 7: 11 };

// Strip diacritics and upper-case: "école" → "ECOLE"
function normalize(w: string): string {
  return w.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function buildList(raw: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw as string[]) {
    const n = normalize(w);
    if (/^[A-Z]{2,7}$/.test(n) && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

const LISTS: Record<string, string[]> = {
  en: buildList(rawEn),
  es: buildList(rawEs),
  fr: buildList(rawFr),
};

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
  const lang    =  req.nextUrl.searchParams.get("lang")    ?? "en";
  if (letters.length !== 7) return NextResponse.json({ words: [] });

  const list  = LISTS[lang] ?? LISTS.en;
  const found = list
    .filter((w) => canBuild(w, letters))
    .map((w) => ({ word: w, pts: SCORE[w.length] ?? 11 }))
    .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));

  return NextResponse.json({ words: found });
}
