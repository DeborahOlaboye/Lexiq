"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUsername, displayName } from "@/lib/player";
import { savePlayToken } from "@/lib/playSession";
import { setBoardWords } from "@/lib/dictionary";
import { isMiniPay } from "@/lib/minipay";
import { selfStartRound } from "@/lib/selfPlay";
import { useFeeCurrency } from "@/hooks/useFeeCurrency";
import { useGasPrice } from "wagmi";
import type { Lang } from "@/lib/guestLetters";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

type Phase = "idle" | "searching" | "matched" | "starting";

/**
 * Head-to-head. Both players get the *same* seven letters — the server signs one seed for the
 * match — and the higher score wins.
 *
 * Wallet players only: guests have no standing on any board, so there would be nothing to win.
 * An opponent who never finishes resolves on a timeout rather than leaving the result hanging,
 * because a dropped connection mid-round is ordinary on the networks this is played over.
 */
export default function Versus({ lang = "en", difficulty = 1, onEnterGame }: {
  lang?: Lang;
  difficulty?: 0 | 1 | 2;
  onEnterGame: (roundId: bigint) => void;
}) {
  const { address } = useAccount();
  const { data: gasPrice } = useGasPrice({ chainId: 42220 });
  const fee = useFeeCurrency(address, gasPrice);

  const [phase, setPhase] = useState<Phase>("idle");
  const [opponent, setOpponent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const matchId = useRef<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const username = getStoredUsername() ?? (address ? displayName(address) : "Anonymous");

  const stopPolling = useCallback(() => {
    if (polling.current) { clearInterval(polling.current); polling.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  /** Opens the match round on the shared board, then hands off to the game. */
  const beginRound = useCallback(async (id: string) => {
    setPhase("starting");
    try {
      if (isMiniPay() && address) {
        const roundId = await selfStartRound({
          player: address, difficulty, lang, feeCurrency: fee.address, matchId: id,
        });
        onEnterGame(roundId);
        return;
      }
      const res = await fetch("/api/round/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: address, difficulty, lang, matchId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the match");
      savePlayToken(data.playToken);
      setBoardWords(data.wordHashes);
      onEnterGame(BigInt(data.roundId));
    } catch (err) {
      setError((err as Error)?.message ?? "Could not start the match");
      setPhase("idle");
    }
  }, [address, difficulty, lang, fee.address, onEnterGame]);

  async function findOpponent() {
    if (!address) return;
    setError(null);
    setPhase("searching");

    const poll = async () => {
      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, username, difficulty, lang }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Matchmaking unavailable");
        if (data.status === "matched") {
          stopPolling();
          matchId.current = data.matchId;
          setOpponent(data.opponent);
          setPhase("matched");
          // A beat to show who they are drawn against before the clock starts.
          setTimeout(() => beginRound(data.matchId), 1500);
        }
      } catch (err) {
        stopPolling();
        setError((err as Error)?.message ?? "Matchmaking unavailable");
        setPhase("idle");
      }
    };

    await poll();
    if (!matchId.current) polling.current = setInterval(poll, 2500);
  }

  async function cancel() {
    stopPolling();
    setPhase("idle");
    if (address) {
      await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, username, difficulty, lang, cancel: true }),
      }).catch(() => {});
    }
  }

  if (!address) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      style={{ background: "#241C13", borderRadius: 20, padding: "clamp(16px,3vw,22px)", border: LINE }}>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "#FF5B45", textTransform: "uppercase" }}>
        Head to head
      </div>
      <p style={{ fontSize: 13, color: "#CBC0AE", margin: "8px 0 14px", lineHeight: 1.5 }}>
        Same seven letters, same clock. Higher score wins.
      </p>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.button key="find" onClick={findOpponent}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{ width: "100%", padding: "clamp(12px,2.5vw,15px)", borderRadius: 14, border: "none",
              background: "#FF5B45", color: "white", fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: "clamp(14px,2.5vw,16px)", cursor: "pointer" }}>
            Find an opponent
          </motion.button>
        )}

        {phase === "searching" && (
          <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ textAlign: "center" }}>
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#FF5B45" }}>
              Looking for an opponent…
            </motion.div>
            <button onClick={cancel}
              style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557" }}>
              Cancel
            </button>
          </motion.div>
        )}

        {(phase === "matched" || phase === "starting") && (
          <motion.div key="matched" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#CFE94B" }}>
              {phase === "starting" ? "Dealing your letters…" : `You vs ${opponent ?? "an opponent"}`}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", marginTop: 6 }}>
              Same board for both of you
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#FF5B45", marginTop: 10, marginBottom: 0 }}>
          {error}
        </p>
      )}
    </motion.div>
  );
}
