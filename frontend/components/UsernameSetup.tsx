"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { saveUsername } from "@/lib/player";

export default function UsernameSetup({ onDone }: { onDone: (name?: string) => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function handleChange(val: string) {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
    setDraft(clean);
    setError("");
  }

  function handleContinue() {
    const name = draft.trim();
    if (!name) { setError("Pick a username to continue"); return; }
    if (name.length < 2) { setError("At least 2 characters"); return; }
    saveUsername(name);
    onDone(name);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(16px,4vw,24px)", background: "rgba(21,17,13,.92)", backdropFilter: "blur(12px)" }}>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.2, 1, 0.4, 1] as [number,number,number,number] }}
        style={{ width: "min(420px,100%)", background: "#1E1710", border: "1px solid var(--line2)", borderRadius: 26, padding: "clamp(28px,6vw,44px)", textAlign: "center" }}
      >
        {/* Floating L tile */}
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [-3, 3, -3] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 60, height: 68, borderRadius: 12, background: "#F3ECDB", boxShadow: "inset 0 -5px 0 #CFC1A6, 0 10px 24px rgba(0,0,0,.45)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 36, color: "#2A2017", marginBottom: 24 }}
        >L</motion.div>

        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", letterSpacing: "-0.02em", margin: "0 0 8px", color: "#F5EFE2" }}>
          What should we call you?
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#9A8C77", margin: "0 0 28px", lineHeight: 1.5 }}>
          This is how you appear on the leaderboard.<br />You can always change it later.
        </p>

        <div style={{ marginBottom: 16 }}>
          <input
            autoFocus
            value={draft}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleContinue()}
            placeholder="e.g. wordmaster_99"
            maxLength={16}
            style={{ width: "100%", background: "#15110D", border: error ? "1px solid rgba(255,91,69,.6)" : "1px solid var(--line2)", borderRadius: 13, padding: "14px 16px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "0.04em", color: "#F5EFE2", outline: "none", textAlign: "center", boxSizing: "border-box" }}
          />
          {error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#FF5B45", marginTop: 6, marginBottom: 0 }}>{error}</p>}
          {!error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", marginTop: 6, marginBottom: 0 }}>
            Letters, numbers, underscores · {16 - draft.length} chars left
          </p>}
        </div>

        <motion.button
          onClick={handleContinue}
          disabled={draft.length < 2}
          animate={draft.length >= 2 ? { boxShadow: ["0 5px 0 #A9C931", "0 5px 20px rgba(207,233,75,.5)", "0 5px 0 #A9C931"] } : {}}
          transition={draft.length >= 2 ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : {}}
          whileHover={draft.length >= 2 ? { scale: 1.02, y: -2 } : undefined}
          whileTap={draft.length >= 2 ? { scale: 0.97 } : undefined}
          style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, cursor: draft.length < 2 ? "default" : "pointer", opacity: draft.length < 2 ? 0.35 : 1, marginBottom: 12 }}
        >
          Continue →
        </motion.button>

        <button
          onClick={() => onDone()}
          style={{ background: "none", border: "none", fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557", cursor: "pointer", padding: "4px 8px" }}
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}
