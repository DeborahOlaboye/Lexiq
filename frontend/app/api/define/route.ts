import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { isWord } from "@/lib/wordlist";
import type { Lang } from "@/lib/guestLetters";

/**
 * A short definition for a word from the missed-words reveal.
 *
 * Wiktionary rather than one of the free dictionary APIs: this dictionary is full of obscure
 * Scrabble entries, and the alternatives do not carry them — Datamuse has no entry for ZARNEC,
 * while Wiktionary defines every board word tested. It also needs no key and is run by
 * Wikimedia, which matters after api.dictionaryapi.dev stopped resolving entirely.
 *
 * Its definition endpoint is English-only; other languages return 501. Those fall through to
 * null, and the UI offers a Wiktionary link instead, so the loop still works.
 *
 * Fetched when a player taps a word rather than for the whole list: fifteen lookups at the end
 * of every round would be fifteen requests on connections that are already the weak point.
 */
const REST = "https://en.wiktionary.org/api/rest_v1/page/definition";

/** Wiktionary returns definitions as HTML fragments. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Entry = { partOfSpeech?: string; definitions?: { definition?: string }[] };

export async function GET(req: NextRequest) {
  const word = (req.nextUrl.searchParams.get("w") ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const lang = (req.nextUrl.searchParams.get("lang") ?? "en") as Lang;
  if (word.length < 2 || word.length > 15) {
    return NextResponse.json({ definition: null }, { status: 400 });
  }
  // Only define words on our own list, so this cannot serve as a general proxy to Wikimedia.
  if (!isWord(word, lang)) return NextResponse.json({ definition: null }, { status: 404 });

  const kv = getRedis();
  const key = `lx:def:${lang}:${word}`;
  if (kv) {
    const hit = await kv.get(key);
    // "" is a remembered miss, so a word with no entry is not re-fetched on every reveal.
    if (hit !== null) return NextResponse.json({ definition: hit || null, cached: true });
  }

  let definition: string | null = null;
  if (lang === "en") {
    try {
      const res = await fetch(`${REST}/${encodeURIComponent(word.toLowerCase())}`, {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "Lexiq/1.0 (https://playlexiq.xyz)" },
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, Entry[]>;
        // Prefer the English section; fall back to whatever the page does have.
        const entries = data.en ?? Object.values(data)[0] ?? [];
        outer: for (const entry of entries) {
          for (const d of entry.definitions ?? []) {
            const text = plainText(d.definition ?? "");
            if (text.length > 1) {
              const pos = entry.partOfSpeech ? `${entry.partOfSpeech.toLowerCase()} · ` : "";
              definition = `${pos}${text}`.slice(0, 200);
              break outer;
            }
          }
        }
      }
    } catch {
      // A slow or unavailable third party must never hold up the results screen.
    }
  }

  if (kv) await kv.set(key, definition ?? "");
  return NextResponse.json({ definition });
}
