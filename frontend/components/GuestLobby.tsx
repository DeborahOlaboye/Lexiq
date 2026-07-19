"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getGuestId, getStoredUsername, getLocalStreak, getXP, getLevel, getRankTitle, getSelectedSkin, saveSkin, SKINS } from "@/lib/player";
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
  transition: { duration: 0.4, ease: [0.2, 1, 0.4, 1] as [number, number, number, number], delay },
});

export default function GuestLobby({
  onPlay,
  onMatchmaking,
}: {
  onPlay: (difficulty: 0 | 1 | 2) => void;
  onMatchmaking?: () => void;
}) {
  const guestId = useRef(typeof window !== "undefined" ? getGuestId() : "").current;
  const { count: streak, longest: longestStreak, lastDate } = typeof window !== "undefined" ? getLocalStreak() : { count: 0, longest: 0, lastDate: "" };
  const today = typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "";
  const lastPlayedToday = lastDate === today;

  const xp       = typeof window !== "undefined" ? getXP() : 0;
  const level    = getLevel(xp);
  const xpPerLv  = 60;
  const xpInLv   = xp % xpPerLv;
  const xpToNext = xpPerLv - xpInLv;
  const xpPct    = Math.round((xpInLv / xpPerLv) * 100);

  const [difficulty, setDifficulty] = useState<0 | 1 | 2>(1);
  const [showDiff, setShowDiff]     = useState(false);
  const [bestScore, setBestScore]   = useState<number | null>(null);
  const [rounds, setRounds]         = useState<number | null>(null);
  const [, forceRender]             = useState(0);
  const [selectedSkinId, setSelectedSkinId] = useState(
    typeof window !== "undefined" ? getSelectedSkin().id : "classic"
  );

  useEffect(() => {
    if (!guestId) return;
    fetch("/api/scores")
      .then(r => r.json())
      .then(({ scores }: { scores: { playerId: string; score: number }[] }) => {
        const filtered = scores.filter(s => s.playerId === guestId);
        if (filtered.length > 0) {
          setBestScore(Math.max(...filtered.map(s => s.score)));
          setRounds(filtered.length);
        }
      })
      .catch(() => {});
  }, [guestId]);

  function pickSkin(id: string) {
    const sk = SKINS.find(s => s.id === id);
    if (!sk) return;
    if (sk.minLevel > level) return; // locked
    saveSkin(id);
    setSelectedSkinId(id);
  }

  const diff = DIFFICULTIES[difficulty];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: "clamp(8px,2vw,16px)" }}>

      {/* Streak banner */}
      <AnimatePresence>
        {streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 1, 0.4, 1] as [number, number, number, number] }}
            style={{ borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: lastPlayedToday ? "rgba(207,233,75,.08)" : "rgba(255,91,69,.08)", border: lastPlayedToday ? "1px solid rgba(207,233,75,.3)" : "1px solid rgba(255,91,69,.3)" }}>
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

      {/* Solo play card */}
      <motion.div {...fadeUp(0)} style={{ background: "#241C13", borderRadius: 22, padding: "clamp(18px,4vw,26px)", border: LINE }}>
        <div style={{ marginBottom: 18 }}>
          <UsernamePrompt onSet={() => forceRender(n => n + 1)} />
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "#9A8C77", textTransform: "uppercase" }}>New round</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,4vw,30px)", letterSpacing: "-0.02em" }}>Ready to race?</div>
          <motion.span
            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ padding: "3px 9px", borderRadius: 8, background: "rgba(207,233,75,.15)", border: "1px solid rgba(207,233,75,.4)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color: "#CFE94B", letterSpacing: "0.1em", flexShrink: 0 }}>
            FREE
          </motion.span>
        </div>
        <div style={{ fontSize: 14, color: "#CBC0AE", marginBottom: 18 }}>7 letters · {diff.time} · longer words score higher</div>

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
                transition={{ duration: 0.22 }} style={{ overflow: "hidden", marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DIFFICULTIES.map(({ label, value, time, desc, color }) => (
                  <motion.button key={value} onClick={() => { setDifficulty(value); setShowDiff(false); }}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    style={{ flex: "1 1 80px", padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left", border: difficulty === value ? `1px solid ${color}` : LINE, background: difficulty === value ? "rgba(245,239,226,.06)" : "#1E1710" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", marginTop: 3 }}>{time} · {desc}</div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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

      {/* Head to head card */}
      <motion.div {...fadeUp(0.08)}
        style={{ background: "linear-gradient(135deg, rgba(255,91,69,.16), rgba(207,233,75,.10))", border: "1px solid rgba(255,91,69,.35)", borderRadius: 22, padding: "clamp(18px,4vw,26px)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -18, right: -10, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,91,69,.18)", pointerEvents: "none" }} />
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "#FF5B45", textTransform: "uppercase", position: "relative" }}>Head to head</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,4vw,28px)", letterSpacing: "-0.02em", margin: "8px 0 4px", position: "relative" }}>Play vs someone</div>
        <div style={{ fontSize: 14, color: "#CBC0AE", position: "relative" }}>Same 7 letters, same clock — whoever scores more wins</div>
        <motion.button
          onClick={onMatchmaking}
          whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
          style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: 16, borderRadius: 14, background: "#FF5B45", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, boxShadow: "0 6px 0 #E2402A", marginTop: 16, cursor: "pointer", border: "none" }}>
          ⚔ Find opponent
        </motion.button>
      </motion.div>

      {/* Stats grid */}
      <motion.div {...fadeUp(0.14)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 11 }}>
        {[
          { label: "Your best", value: bestScore !== null ? String(bestScore) : "—", sub: "points",  lime: true },
          { label: "Rounds",    value: rounds    !== null ? String(rounds)    : "—", sub: "played",   lime: false },
          { label: "Streak",    value: streak > 0 ? `${streak}d` : "—",             sub: "current",  lime: false },
        ].map(({ label, value, sub, lime }, i) => (
          <motion.div key={label} {...fadeUp(0.08 + i * 0.07)}
            style={{ background: "#241C13", borderRadius: 16, padding: "clamp(12px,2.5vw,16px)", border: LINE }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase" }}>{label}</div>
            <motion.div
              animate={lime ? { textShadow: ["0 0 0 rgba(207,233,75,0)", "0 0 14px rgba(207,233,75,0.55)", "0 0 0 rgba(207,233,75,0)"] } : { opacity: [0.75, 1, 0.75] }}
              transition={{ duration: lime ? 2.4 : 3.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,3.5vw,22px)", marginTop: 4, color: lime ? "#CFE94B" : "#F5EFE2" }}>
              {value}
            </motion.div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#6E6557", marginTop: 2 }}>{sub}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* XP / Level bar */}
      <motion.div {...fadeUp(0.18)} style={{ background: "#241C13", border: LINE, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16 }}>
            Level {level} · <span style={{ color: "#CFE94B" }}>{getRankTitle(level)}</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77" }}>{xpToNext} XP to next</div>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: "#1E1710", border: LINE, overflow: "hidden", marginTop: 9 }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${xpPct}%` }}
            transition={{ duration: 0.7, ease: [0.2, 1, 0.4, 1] as [number, number, number, number] }}
            style={{ height: "100%", background: "linear-gradient(90deg, #CFE94B, #FF5B45)", borderRadius: 5 }} />
        </div>
        <div style={{ fontSize: 11, color: "#6E6557", marginTop: 8 }}>Earn XP every round to unlock tile skins</div>

        {/* Skin picker */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {SKINS.map(sk => {
            const locked   = sk.minLevel > level;
            const selected = sk.id === selectedSkinId;
            return (
              <motion.button key={sk.id}
                onClick={() => pickSkin(sk.id)}
                whileHover={!locked ? { scale: 1.05 } : undefined}
                whileTap={!locked ? { scale: 0.96 } : undefined}
                title={locked ? `Unlock at Level ${sk.minLevel}` : sk.name}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 11, cursor: locked ? "not-allowed" : "pointer", background: "#1E1710", border: selected ? "1px solid #CFE94B" : LINE, opacity: locked ? 0.4 : 1 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: sk.bg, boxShadow: `inset 0 -2px 0 ${sk.edge}`, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: selected ? "#CFE94B" : "#CBC0AE" }}>{sk.name}</span>
                {locked && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#6E6557" }}>Lv{sk.minLevel}</span>}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
