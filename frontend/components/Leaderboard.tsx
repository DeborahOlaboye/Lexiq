"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import { motion, AnimatePresence } from "framer-motion";
import UsernamePrompt from "./UsernamePrompt";
import { getStoredUsername, getGuestId } from "@/lib/player";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";
const MEDALS = ["#F4C84B", "#C9CBD1", "#CD8C5C"];
const SCORING = [
  { label: "2 L",  pts: "1",  hot: false },
  { label: "3 L",  pts: "2",  hot: false },
  { label: "4 L",  pts: "3",  hot: false },
  { label: "5 L",  pts: "5",  hot: false },
  { label: "6 L",  pts: "8",  hot: true  },
  { label: "7 L+", pts: "11", hot: true  },
];

type Row = { playerId: string; username: string; score: number };

export default function Leaderboard({ isGuest }: { isGuest?: boolean }) {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;

  const [rows, setRows]           = useState<Row[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [, forceRender]           = useState(0);

  const { data: prize }   = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "weeklyPrizePool" });
  const { data: myHigh }  = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore",  args: address ? [address] : undefined });
  const { data: myTotal } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "totalScore", args: address ? [address] : undefined });
  const { data: played }  = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "gamesPlayed",args: address ? [address] : undefined });

  const myPlayerId = address ?? (typeof window !== "undefined" ? getGuestId() : "");

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const res = await fetch("/api/scores");
      const { scores } = await res.json() as { scores: Row[] };
      setRows(scores ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setLastFetch(Date.now());
    }
  }

  useEffect(() => { fetchLeaderboard(); }, []); // eslint-disable-line

  const prizeFormatted = prize ? (Number(prize) / 1e18).toFixed(2) : "—";
  const username = getStoredUsername();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: "clamp(8px,2vw,16px)" }}>

      {/* Username prompt */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ background: "#241C13", borderRadius: 14, padding: "12px 16px", border: LINE, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <UsernamePrompt onSet={() => forceRender(n => n + 1)} />
        {!username && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#6E6557" }}>
            Set a name so others recognise you
          </span>
        )}
      </motion.div>

      {/* Prize pool — wallet users only */}
      {!isGuest && (
        <div style={{ borderRadius: 20, padding: "clamp(18px,4vw,26px)", textAlign: "center", background: "linear-gradient(135deg,rgba(207,233,75,.14),rgba(255,91,69,.08))", border: "1px solid rgba(207,233,75,.35)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "#CFE94B", textTransform: "uppercase" }}>Weekly prize pool</div>
          </div>
          <motion.div
            animate={{ textShadow: ["0 0 0 rgba(207,233,75,0)", "0 0 20px rgba(207,233,75,0.5)", "0 0 0 rgba(207,233,75,0)"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,8vw,44px)", color: "#CFE94B", lineHeight: 1, marginBottom: 4 }}
          >{prizeFormatted}</motion.div>
          <div style={{ fontSize: 12, color: "#CBC0AE" }}>USDM</div>
        </div>
      )}

      {/* Stats — wallet only */}
      {address && !isGuest && (
        <div style={{ background: "#241C13", borderRadius: 16, padding: "clamp(14px,3vw,18px)", border: LINE, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[
            { label: "Best",   val: myHigh?.toString()  ?? "—", lime: true  },
            { label: "Total",  val: myTotal?.toString()  ?? "—", lime: false },
            { label: "Rounds", val: played?.toString()   ?? "—", lime: false },
          ].map(({ label, val, lime }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,4vw,22px)", marginTop: 4, color: lime ? "#CFE94B" : "#F5EFE2" }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard table */}
      <div style={{ background: "#241C13", borderRadius: 18, overflow: "hidden", border: LINE }}>
        <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: LINE }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "#9A8C77", textTransform: "uppercase" }}>
            Top players · all time
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastFetch > 0 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#6E6557" }}>
                {Math.round((Date.now() - lastFetch) / 1000)}s ago
              </span>
            )}
            <button onClick={fetchLeaderboard} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", background: "none", border: "none", cursor: "pointer" }}>↻</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#6E6557" }}>Loading…</span>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <p style={{ color: "#9A8C77", fontSize: 14, margin: "0 0 6px" }}>No scores yet — be the first!</p>
            <p style={{ color: "#6E6557", fontSize: 11, fontFamily: "var(--font-mono)", margin: 0 }}>
              {isGuest ? "Finish a round to appear here" : "Play a round to appear here"}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {rows.map(({ playerId, username: uname, score }, i) => {
              const isMe = playerId === myPlayerId || playerId.toLowerCase() === (address ?? "").toLowerCase();
              return (
                <motion.div key={playerId}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < rows.length - 1 ? LINE : undefined, background: isMe ? "rgba(207,233,75,.07)" : undefined }}>
                  <span style={{ width: 24, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: MEDALS[i] ?? "#9A8C77", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: isMe ? "#CFE94B" : "#CBC0AE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {uname}{isMe ? " (you)" : ""}
                  </span>
                  <motion.span
                    animate={isMe ? { textShadow: ["0 0 0 rgba(207,233,75,0)", "0 0 10px rgba(207,233,75,0.5)", "0 0 0 rgba(207,233,75,0)"] } : {}}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: isMe ? "#CFE94B" : "#F5EFE2" }}>
                    {score}
                  </motion.span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Scoring guide */}
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 9 }}>Scoring guide</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8 }}>
          {SCORING.map(({ label, pts, hot }) => (
            <div key={label} style={{ background: "#241C13", borderRadius: 11, padding: "clamp(8px,2vw,10px)", textAlign: "center", border: hot ? "1px solid rgba(255,91,69,.4)" : LINE2 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: hot ? "#FF5B45" : "#9A8C77" }}>{label}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(16px,3.5vw,18px)", marginTop: 2, color: hot ? "#FF5B45" : "#CBC0AE" }}>{pts}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
