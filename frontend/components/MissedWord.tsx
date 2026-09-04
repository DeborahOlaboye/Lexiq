"use client";
import { useState } from "react";
import type { Lang } from "@/lib/guestLetters";

const WIKTIONARY: Record<Lang, string> = {
  en: "https://en.wiktionary.org/wiki/",
  es: "https://es.wiktionary.org/wiki/",
  fr: "https://fr.wiktionary.org/wiki/",
};

/**
 * A word from the missed-words reveal, tappable for its meaning.
 *
 * Seeing what you missed teaches you the shape of the board; seeing what it *means* is what
 * makes the word stick, which is the whole point of the round being over and the list being
 * shown at all.
 *
 * Definitions are fetched on tap rather than for the whole list: fifteen lookups at the end of
 * every round would be fifteen requests on connections that are already the weak point. When
 * no definition comes back — the source is optional and may be unset — the word falls back to
 * a dictionary link, so the loop still works rather than dead-ending.
 */
export default function MissedWord({ word, pts, lang }: { word: string; pts: number; lang: Lang }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [definition, setDefinition] = useState<string | null>(null);

  async function reveal() {
    if (state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch(`/api/define?w=${encodeURIComponent(word)}&lang=${lang}`);
      const data = res.ok ? await res.json() : null;
      setDefinition(data?.definition ?? null);
    } catch {
      setDefinition(null);
    }
    setState("done");
  }

  const chip: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9,
    background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "#6E6557",
    cursor: state === "idle" ? "pointer" : "default", textAlign: "left",
  };

  if (state === "done" && !definition) {
    // No definition available — send them somewhere that has one.
    return (
      <a href={`${WIKTIONARY[lang] ?? WIKTIONARY.en}${word.toLowerCase()}`}
         target="_blank" rel="noopener noreferrer"
         style={{ ...chip, cursor: "pointer", textDecoration: "none", color: "#9A8C77" }}>
        {word} <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: 11 }}>look up ↗</span>
      </a>
    );
  }

  if (state === "done" && definition) {
    return (
      <span style={{ ...chip, flexDirection: "column", alignItems: "flex-start", gap: 3, maxWidth: "100%" }}>
        <span>{word} <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: 11 }}>+{pts}</span></span>
        <span style={{ fontFamily: "var(--font-ui)", fontWeight: 400, fontSize: 11, color: "#9A8C77", lineHeight: 1.4 }}>
          {definition}
        </span>
      </span>
    );
  }

  return (
    <button onClick={reveal} style={{ ...chip }} aria-label={`What does ${word} mean?`}>
      {word} <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        {state === "loading" ? "…" : `+${pts}`}
      </span>
    </button>
  );
}
