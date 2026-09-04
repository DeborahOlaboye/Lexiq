"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { getStoredUsername, displayName } from "@/lib/player";
import { savePlayToken } from "@/lib/playSession";
import { setBoardWords } from "@/lib/dictionary";
import type { Lang } from "@/lib/guestLetters";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

type Row = { playerId: string; username: string; percent: number; score: number; maxScore: number };
type Daily = {
  date: string; difficultyLabel: string; seconds: number;
  alreadyPlayed: boolean; rows: Row[];
};

/**
 * Today's challenge — the same settings for everyone, but each player's own board.
 *
 * Not one shared set of letters: those go on-chain the moment the first player opens the
 * round, which would leave the rest of the day for everyone else to read and pre-solve them.
 * Ranking is by the share of your own board you found, so a generous draw is worth no more
 * than a barren one and separate boards stay comparable.
 */
export default function DailyChallenge({ lang = "en", onEnterGame }: {
  lang?: Lang;
  onEnterGame: (roundId: bigint) => void;
}) {
  const { address } = useAccount();
  const [daily, setDaily] = useState<Daily | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = address ? `?player=${address}` : "";
      const res = await fetch(`/api/daily${q}`);
      if (res.ok) setDaily(await res.json());
    } catch { /* the lobby still works without it */ }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  async function play() {
    if (busy || !address) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/round/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: address, lang, daily: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start today's challenge");
      savePlayToken(data.playToken);
      setBoardWords(data.wordHashes);
      onEnterGame(BigInt(data.roundId));
    } catch (err) {
      setError((err as Error)?.message ?? "Could not start today's challenge");
      setBusy(false);
      load();
    }
  }

  if (!daily) return null;
  const me = getStoredUsername() ?? (address ? displayName(address) : null);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      style={{ background: "#241C13", borderRadius: 20, padding: "clamp(16px,3vw,22px)", border: LINE }}>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "#CFE94B", textTransform: "uppercase" }}>
          Today&apos;s challenge
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557" }}>
          {daily.difficultyLabel} · {daily.seconds}s · one try
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#CBC0AE", margin: "8px 0 14px", lineHeight: 1.5 }}>
        Everyone plays the same settings today, on their own letters. Ranked by how much of your
        board you found.
      </p>

      {daily.alreadyPlayed ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77", padding: "10px 0" }}>
          ✓ Played today — back tomorrow
        </div>
      ) : (
        <motion.button onClick={play} disabled={busy || !address}
          whileHover={!busy && address ? { scale: 1.02 } : undefined}
          whileTap={!busy && address ? { scale: 0.98 } : undefined}
          style={{ width: "100%", padding: "clamp(12px,2.5vw,15px)", borderRadius: 14, border: "none",
            background: address ? "#CFE94B" : "#2F2517", color: address ? "#15110D" : "#6E6557",
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(14px,2.5vw,16px)",
            cursor: busy || !address ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Starting…" : address ? "Play today's challenge" : "Sign in to play the daily"}
        </motion.button>
      )}

      {error && (
        <p role="alert" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#FF5B45", marginTop: 9, marginBottom: 0 }}>
          {error}
        </p>
      )}

      {daily.rows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 8 }}>
            Today · top {Math.min(daily.rows.length, 10)}
          </div>
          {daily.rows.slice(0, 10).map((r, i) => {
            const isMe = !!address && r.playerId.toLowerCase() === address.toLowerCase();
            return (
              <div key={r.playerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < 9 ? LINE2 : undefined }}>
                <span style={{ width: 20, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: i < 3 ? "#F4C84B" : "#6E6557" }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: isMe ? "#CFE94B" : "#CBC0AE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isMe ? (me ?? r.username) : r.username}{isMe ? " (you)" : ""}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557" }}>{r.score}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: isMe ? "#CFE94B" : "#F5EFE2", minWidth: 44, textAlign: "right" }}>
                  {r.percent.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
