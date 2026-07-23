import { NextRequest, NextResponse } from "next/server";
import rawEn from "an-array-of-english-words";
import rawEs from "an-array-of-spanish-words";
import rawFr from "an-array-of-french-words";

// Strip diacritics and upper-case: "école" → "ECOLE"
function normalize(w: string): string {
  return w.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function buildSet(raw: unknown): Set<string> {
  return new Set(
    (raw as string[])
      .map(normalize)
      .filter((w) => /^[A-Z]{2,7}$/.test(w))
  );
}

const SETS: Record<string, Set<string>> = {
  en: buildSet(rawEn),
  es: buildSet(rawEs),
  fr: buildSet(rawFr),
};

export function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("w");
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";
  if (!word) return NextResponse.json({ valid: false });
  const set = SETS[lang] ?? SETS.en;
  return NextResponse.json({ valid: set.has(word.toUpperCase()) });
}
