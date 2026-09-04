"use client";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";

const LINE = "1px solid var(--line)";

type Outcome = {
  state: "waiting" | "playing" | "finished";
  you?: { username: string; score?: number };
  opponent?: { username: string; score?: number };
  result?: "won" | "lost" | "drew" | "opponent-did-not-finish";
};

/**
 * The outcome of a head-to-head, shown once the player's own round has settled.
 *
 * Polls while the opponent is still playing. An opponent who never finishes resolves on the
 * server's timeout rather than leaving this spinning forever — losing a connection mid-round
 * is ordinary on the networks this is played over, and the player should not be stranded by it.
 */
export default function MatchResult() {
  const { address } = useAccount();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/api/match?address=${address}`);
        if (!res.ok) return;
        const d = (await res.json()) as Outcome;
        if (cancelled) return;
        setOutcome(d);
        if (d.state === "finished" && timer) clearInterval(timer);
      } catch { /* keep waiting */ }
    };

    check();
    const timer = setInterval(check, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [address]);

  if (!outcome || outcome.state === "waiting") return null;
  if (outcome.you?.score === undefined) return null;

  const waiting = outcome.state === "playing";
  const tone =
    outcome.result === "won" ? { bg: "rgba(207,233,75,.10)", border: "rgba(207,233,75,.35)", color: "#CFE94B" }
    : outcome.result === "lost" ? { bg: "rgba(255,91,69,.10)", border: "rgba(255,91,69,.35)", color: "#FF5B45" }
    : { bg: "rgba(255,255,255,.04)", border: "var(--line)", color: "#CBC0AE" };

  const headline =
    waiting ? "Waiting for your opponent…"
    : outcome.result === "won" ? "You win"
    : outcome.result === "lost" ? "You lose"
    : outcome.result === "drew" ? "A draw"
    : "Opponent didn’t finish — you win by default";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      style={{ width: "100%", marginTop: 12, borderRadius: 14, padding: 14,
        background: waiting ? "rgba(255,255,255,.04)" : tone.bg,
        border: `1px solid ${waiting ? "var(--line)" : tone.border}` }}>

      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: waiting ? "#CBC0AE" : tone.color, textAlign: "center" }}>
        {headline}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", textTransform: "uppercase" }}>You</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "#F5EFE2" }}>{outcome.you?.score}</div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557" }}>vs</div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {outcome.opponent?.username ?? "Opponent"}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "#F5EFE2" }}>
            {outcome.opponent?.score ?? "—"}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
