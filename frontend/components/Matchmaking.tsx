"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUsername } from "@/lib/player";

const OPPONENT_NAMES = ["wordwolf", "lex_ari", "quiztin", "novaread", "inkbyte", "syllabist", "lexlord"];

export default function Matchmaking({ onFound, onCancel }: { onFound: () => void; onCancel: () => void }) {
  const [phase, setPhase] = useState<"searching" | "found">("searching");
  const [opponent] = useState(() => OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)]);
  const myName = getStoredUsername() ?? "You";
  const myInitial = myName[0]?.toUpperCase() ?? "Y";
  const oppInitial = opponent[0]?.toUpperCase() ?? "?";

  useEffect(() => {
    // Simulate matchmaking: 2.2s searching → found → 1.4s delay → start
    const t1 = setTimeout(() => setPhase("found"), 2200);
    const t2 = setTimeout(() => onFound(), 2200 + 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line

  return (
    <div style={{ width: "min(480px, 100%)", margin: "0 auto", padding: "clamp(40px,8vw,80px) clamp(16px,4vw,24px) 40px", textAlign: "center" }}>

      <AnimatePresence mode="wait">
        {phase === "searching" ? (
          <motion.div key="searching" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            {/* Spinning loader */}
            <div style={{ width: 84, height: 84, margin: "0 auto 22px", borderRadius: "50%", border: "4px solid rgba(255,255,255,.1)", borderTopColor: "#FF5B45", animation: "spin 0.9s linear infinite" }} />
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "#F5EFE2" }}>Finding an opponent…</div>
            <p style={{ color: "#CBC0AE", fontSize: 14, margin: "8px 0 0" }}>Matching you with a player near your skill level</p>
            <button onClick={onCancel}
              style={{ marginTop: 28, fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557", background: "none", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "8px 18px", cursor: "pointer" }}>
              Cancel
            </button>
          </motion.div>
        ) : (
          <motion.div key="found" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {/* VS reveal */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.2, 1.5, 0.4, 1] as [number, number, number, number] }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: "#CFE94B", color: "#15110D", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24 }}>{myInitial}</div>
                <span style={{ fontSize: 12, color: "#CBC0AE" }}>You</span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#9A8C77" }}>VS</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: "#FF5B45", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24 }}>{oppInitial}</div>
                <span style={{ fontSize: 12, color: "#CBC0AE" }}>{opponent}</span>
              </div>
            </motion.div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, marginTop: 22, color: "#F5EFE2" }}>Opponent found!</div>
            <p style={{ color: "#CBC0AE", fontSize: 14, margin: "8px 0 0" }}>Starting in a moment…</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20 }}>
              {[0, 1, 2].map(i => (
                <motion.span key={i}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                  style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#CFE94B" }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
