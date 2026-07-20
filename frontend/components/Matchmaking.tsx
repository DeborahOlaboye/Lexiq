"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUsername, getGuestId } from "@/lib/player";

type Phase    = "searching" | "found" | "no-opponent";
type Opponent = { id: string; username: string };

const SEARCH_TIMEOUT_MS = 28_000;
const POLL_INTERVAL_MS  =  2_500;

export default function Matchmaking({
  onFound,
  onCancel,
}: {
  onFound:   () => void;
  onCancel:  () => void;
}) {
  const [phase,    setPhase]    = useState<Phase>("searching");
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [elapsed,  setElapsed]  = useState(0);

  const myId      = useRef(getGuestId());
  const myName    = useRef(getStoredUsername() ?? "Anonymous");
  const pollRef   = useRef<ReturnType<typeof setInterval>  | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout>   | null>(null);
  const tickRef   = useRef<ReturnType<typeof setInterval>  | null>(null);
  const mounted   = useRef(false);

  function clearAll() {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickRef.current)  clearInterval(tickRef.current);
  }

  function handleMatched(opp: Opponent) {
    clearAll();
    setOpponent(opp);
    setPhase("found");
    setTimeout(onFound, 1800);
  }

  async function leaveQueue() {
    await fetch(`/api/matchmaking?playerId=${encodeURIComponent(myId.current)}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  function startPolling() {
    // Poll every 2.5s for a match
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/matchmaking?playerId=${encodeURIComponent(myId.current)}`);
        const data = await res.json() as { status: string; opponent?: Opponent };
        if (data.status === "matched" && data.opponent) {
          handleMatched(data.opponent);
        }
        // "waiting" | "expired" → keep waiting; timeout handles the cutoff
      } catch {
        // network hiccup — keep trying
      }
    }, POLL_INTERVAL_MS);

    // Hard timeout — nobody showed up
    timerRef.current = setTimeout(async () => {
      clearAll();
      await leaveQueue();
      setPhase("no-opponent");
    }, SEARCH_TIMEOUT_MS);
  }

  async function joinQueue() {
    try {
      const res  = await fetch("/api/matchmaking", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ playerId: myId.current, username: myName.current }),
      });
      const data = await res.json() as { status: string; opponent?: Opponent };

      if (data.status === "matched" && data.opponent) {
        handleMatched(data.opponent);
        return;
      }

      if (data.status === "no-kv" || data.status === "error") {
        setPhase("no-opponent");
        return;
      }

      // "waiting" — start polling
      startPolling();
    } catch {
      setPhase("no-opponent");
    }
  }

  // Initial join
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    joinQueue();

    // Elapsed counter for UI
    tickRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    return () => {
      clearAll();
      void leaveQueue();
    };
  }, []); // eslint-disable-line

  async function handleCancel() {
    clearAll();
    await leaveQueue();
    onCancel();
  }

  async function handleRetry() {
    clearAll();
    setPhase("searching");
    setElapsed(0);
    // Restart elapsed tick
    tickRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    await joinQueue();
  }

  const myInitial  = myName.current[0]?.toUpperCase()      ?? "Y";
  const oppInitial = opponent?.username[0]?.toUpperCase()   ?? "?";

  return (
    <div style={{ width: "min(480px, 100%)", margin: "0 auto", padding: "clamp(40px,8vw,80px) clamp(16px,4vw,24px) 40px", textAlign: "center" }}>
      <AnimatePresence mode="wait">

        {/* ── Searching ── */}
        {phase === "searching" && (
          <motion.div key="searching"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 22px", borderRadius: "50%", border: "4px solid rgba(255,255,255,.1)", borderTopColor: "#FF5B45", animation: "spin 0.9s linear infinite" }} />
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "#F5EFE2" }}>
              Finding an opponent…
            </div>
            <p style={{ color: "#CBC0AE", fontSize: 14, margin: "8px 0 24px" }}>
              Searching for live players · {elapsed}s
            </p>
            <button onClick={handleCancel}
              style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557", background: "none", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "8px 18px", cursor: "pointer" }}>
              Cancel
            </button>
          </motion.div>
        )}

        {/* ── Found ── */}
        {phase === "found" && opponent && (
          <motion.div key="found"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.2, 1.5, 0.4, 1] as [number, number, number, number] }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: "#CFE94B", color: "#15110D", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24 }}>
                  {myInitial}
                </div>
                <span style={{ fontSize: 12, color: "#CBC0AE" }}>{myName.current}</span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#9A8C77" }}>VS</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: "#FF5B45", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24 }}>
                  {oppInitial}
                </div>
                <span style={{ fontSize: 12, color: "#CBC0AE" }}>{opponent.username}</span>
              </div>
            </motion.div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, marginTop: 22, color: "#F5EFE2" }}>
              Opponent found!
            </div>
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

        {/* ── No opponent ── */}
        {phase === "no-opponent" && (
          <motion.div key="no-opponent"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>🎯</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "#F5EFE2" }}>
              No opponents online
            </div>
            <p style={{ color: "#9A8C77", fontSize: 14, margin: 0, lineHeight: 1.55 }}>
              Nobody's searching right now.<br />Try again or jump into a solo round.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, width: "100%", maxWidth: 280, marginTop: 8 }}>
              <motion.button onClick={handleRetry}
                whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                style={{ padding: "14px", borderRadius: 13, background: "#FF5B45", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, cursor: "pointer", border: "none", boxShadow: "0 5px 0 #C73C27" }}>
                Search again
              </motion.button>
              <button onClick={handleCancel}
                style={{ padding: "13px", borderRadius: 13, border: "1px solid rgba(255,255,255,.12)", color: "#CBC0AE", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer", background: "transparent" }}>
                Back to lobby
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
