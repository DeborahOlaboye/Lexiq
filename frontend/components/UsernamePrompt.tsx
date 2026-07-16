"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUsername, saveUsername } from "@/lib/player";

const LINE = "1px solid var(--line)";

export default function UsernamePrompt({ onSet }: { onSet?: (name: string) => void }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [editing, setEditing]  = useState(false);
  const [draft, setDraft]      = useState("");

  useEffect(() => { setCurrent(getStoredUsername()); }, []);

  function save() {
    const n = draft.trim().slice(0, 20);
    if (!n) return;
    saveUsername(n);
    setCurrent(n);
    setEditing(false);
    setDraft("");
    onSet?.(n);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77", flexShrink: 0 }}>
        Playing as:
      </span>
      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="edit" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
            style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              autoFocus value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 20))}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              placeholder="Enter username…" maxLength={20}
              style={{ background: "#1E1710", border: LINE, borderRadius: 8, padding: "5px 10px", fontFamily: "var(--font-mono)", fontSize: 12, color: "#F5EFE2", outline: "none", width: 140 }} />
            <motion.button onClick={save} whileTap={{ scale: 0.92 }}
              style={{ background: draft.trim() ? "#CFE94B" : "#2F2517", border: "none", borderRadius: 7, padding: "5px 10px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11, color: draft.trim() ? "#15110D" : "#6E6557", cursor: draft.trim() ? "pointer" : "default" }}>
              Save
            </motion.button>
            <button onClick={() => setEditing(false)}
              style={{ background: "none", border: "none", fontSize: 12, color: "#6E6557", cursor: "pointer", padding: "5px 4px" }}>✕</button>
          </motion.div>
        ) : (
          <motion.button key="display" onClick={() => { setDraft(current ?? ""); setEditing(true); }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            whileHover={{ opacity: 0.7 }}
            style={{ background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: current ? "#CFE94B" : "#6E6557" }}>
              {current ?? "Set a username"}
            </span>
            <span style={{ fontSize: 10, color: "#6E6557" }}>✎</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
