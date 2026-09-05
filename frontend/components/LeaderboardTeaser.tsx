"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const LINE = "1px solid var(--line)";

type Row = { playerId: string; username: string; score: number; points: number };

/**
 * What a guest sees where the leaderboard would be.
 *
 * Guests are not ranked and cannot reach the board itself — that stays for signed-in players.
 * But hiding it completely gave a guest no reason to sign in: an empty gate asks for a login
 * without ever showing what the login is for. Three real names and their scores answer that in
 * a way no amount of copy does, and the rest stays locked.
 */
export default function LeaderboardTeaser({ onSignIn }: { onSignIn: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scores");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRows((data.scores ?? []).slice(0, 3));
      } catch { /* the gate below still stands on its own */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const medal = ["#F4C84B", "#CBC0AE", "#C98B45"];

  return (
    <div style={{ background: "#241C13", border: LINE, borderRadius: 18, padding: "clamp(20px,5vw,30px)", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,4vw,22px)", marginBottom: 6 }}>
        Sign in to compete
      </div>
      <p style={{ color: "#9A8C77", fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>
        The leaderboard and the weekly prize pool are for signed-in players.
        Your guest progress stays on this device.
      </p>

      {rows && rows.length > 0 && (
        <div style={{ textAlign: "left", marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 8 }}>
            Top players right now
          </div>

          {rows.map((r, i) => (
            <motion.div key={r.playerId}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#2F2517", border: LINE, borderRadius: 12, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: medal[i], width: 18 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "#F5EFE2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.username}
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: "#CFE94B" }}>
                {r.points}
              </span>
            </motion.div>
          ))}

          {/* The board continues; a guest just cannot read it. Blurred rather than absent so
              it is obvious there is something behind the gate. */}
          <div style={{ position: "relative", marginTop: 2 }}>
            <div aria-hidden style={{ filter: "blur(4px)", opacity: 0.5, pointerEvents: "none" }}>
              {["————————", "——————"].map((bar, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#2F2517", border: LINE, borderRadius: 12, marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: "#9A8C77", width: 18 }}>{i + 4}</span>
                  <span style={{ flex: 1, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "#9A8C77" }}>{bar}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: "#9A8C77" }}>···</span>
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "#CBC0AE" }}>
              Sign in to see the full board
            </div>
          </div>
        </div>
      )}

      <button onClick={onSignIn}
        style={{ padding: "13px 26px", borderRadius: 14, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, cursor: "pointer", width: "100%" }}>
        Sign In
      </button>
    </div>
  );
}
