"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getGuestId, getStoredUsername } from "@/lib/player";
import { usePlayerStreak } from "@/hooks/usePlayerStreak";
import UsernamePrompt from "./UsernamePrompt";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

const DIFFICULTIES = [
  { label: "Easy",   value: 0 as const, time: "120s", desc: "More time, common letters", color: "#CFE94B" },
  { label: "Normal", value: 1 as const, time: "90s",  desc: "The classic Lexiq",         color: "#F5EFE2" },
  { label: "Hard",   value: 2 as const, time: "60s",  desc: "Less time, tough letters",  color: "#FF5B45" },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.2, 1, 0.4, 1] as [number,number,number,number], delay },
});

export default function GuestLobby({ onPlay }: { onPlay: (difficulty: 0|1|2) => void }) {
  const guestId    = useRef(typeof window !== "undefined" ? getGuestId() : "").current;
  const { streak, longestStreak, lastPlayedToday } = usePlayerStreak(guestId || undefined);
  const [difficulty, setDifficulty] = useState<0|1|2>(1);
  const [showDiff, setShowDiff]     = useState(false);
  const [bestScore, setBestScore]   = useState<number | null>(null);
  const [, forceRender]             = useState(0);

  // Fetch this guest's best score from the leaderboard
  useEffect(() => {
    if (!guestId) return;
    fetch("/api/scores")
      .then(r => r.json())
      .then(({ scores }: { scores: { playerId: string; score: number }[] }) => {
        const me = scores.find(s => s.playerId === guestId);
        if (me) setBestScore(me.score);
      })
      .catch(() => {});
  }, [guestId]);

  const diff = DIFFICULTIES[difficulty];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: "clamp(8px,2vw,16px)" }}>

      {/* Streak banner */}
      <AnimatePresence>
        {streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 1, 0.4, 1] as [number,number,number,number] }}
            style={{ borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
              background: lastPlayedToday ? "rgba(207,233,75,.08)" : "rgba(255,91,69,.08)",
              border: lastPlayedToday ? "1px solid rgba(207,233,75,.3)" : "1px solid rgba(255,91,69,.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <motion.span animate={{ scale: [1, 1.35, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} style={{ fontSize: 22 }}>🔥</motion.span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: lastPlayedToday ? "#CFE94B" : "#FF5B45" }}>
                  {streak}-day streak{streak >= 7 ? " 🏆" : ""}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77", marginTop: 2 }}>
                  {lastPlayedToday ? `Kept alive · best ever: ${longestStreak} days` : "⚠ Play today to keep your streak!"}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero card */}
      <motion.div {...fadeUp(0)} style={{ background: "#241C13", borderRadius: 22, padding: "clamp(18px,4vw,26px)", border: LINE }}>

        {/* Username */}
        <div style={{ marginBottom: 18 }}>
          <UsernamePrompt onSet={() => forceRender(n => n + 1)} />
        </div>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,4vw,30px)", letterSpacing: "-0.02em" }}>Ready to race?</div>
          <motion.span
            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8], boxShadow: ["0 0 0 0 rgba(207,233,75,0)", "0 0 10px 3px rgba(207,233,75,0.35)", "0 0 0 0 rgba(207,233,75,0)"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ padding: "3px 9px", borderRadius: 8, background: "rgba(207,233,75,.15)", border: "1px solid rgba(207,233,75,.4)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color: "#CFE94B", letterSpacing: "0.1em", flexShrink: 0 }}>
            FREE
          </motion.span>
        </div>
        <div style={{ fontSize: 14, color: "#CBC0AE", marginBottom: 20 }}>7 letters · {diff.time} · longer words score higher</div>

        {/* Difficulty picker */}
        <div style={{ marginBottom: 18 }}>
          <motion.button onClick={() => setShowDiff(v => !v)} whileHover={{ opacity: 0.8 }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77" }}>
              {showDiff ? "▾" : "▸"} Difficulty: <span style={{ color: diff.color }}>{diff.label}</span>
            </span>
          </motion.button>
          <AnimatePresence>
            {showDiff && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.2, 1, 0.4, 1] as [number,number,number,number] }}
                style={{ overflow: "hidden", marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DIFFICULTIES.map(({ label, value, time, desc, color }) => (
                  <motion.button key={value} onClick={() => { setDifficulty(value); setShowDiff(false); }}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    style={{ flex: "1 1 80px", padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                      border: difficulty === value ? `1px solid ${color}` : LINE,
                      background: difficulty === value ? "rgba(245,239,226,.06)" : "#1E1710" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", marginTop: 3 }}>{time} · {desc}</div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Play button */}
        <motion.button
          onClick={() => onPlay(difficulty)}
          animate={{ boxShadow: ["0 6px 0 #A9C931", "0 6px 24px rgba(207,233,75,0.6)", "0 6px 0 #A9C931"], y: [0, -3, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "clamp(14px,3vw,17px)", borderRadius: 15, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(16px,3vw,18px)", cursor: "pointer" }}>
          <span style={{ fontSize: 13 }}>▶</span>
          Play for Free · {diff.label}
        </motion.button>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", textAlign: "center", marginTop: 10, marginBottom: 0 }}>
          No wallet needed · scores saved to shared leaderboard
        </p>
      </motion.div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 11 }}>
        {[
          { label: "Your best", value: bestScore !== null ? String(bestScore) : "—", lime: true },
          { label: "Streak",    value: streak > 0 ? `${streak}d` : "—",             lime: false },
          { label: "Best ever", value: longestStreak > 0 ? `${longestStreak}d` : "—", lime: false },
        ].map(({ label, value, lime }, i) => (
          <motion.div key={label} {...fadeUp(0.08 + i * 0.07)}
            style={{ background: "#241C13", borderRadius: 16, padding: "clamp(12px,2.5vw,16px)", border: LINE }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase" }}>{label}</div>
            <motion.div
              animate={lime ? { textShadow: ["0 0 0 rgba(207,233,75,0)", "0 0 14px rgba(207,233,75,0.55)", "0 0 0 rgba(207,233,75,0)"] } : { opacity: [0.75, 1, 0.75] }}
              transition={{ duration: lime ? 2.4 : 3.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,3.5vw,22px)", marginTop: 4, color: lime ? "#CFE94B" : "#F5EFE2" }}>
              {value}
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
