"use client";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

type Row = { playerId: string; username: string; points: number };
type Weekly = { week: string; endsIn: number; funded: boolean; prizePool: string; rows: Row[] };

function countdown(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * This week's standings.
 *
 * Deliberately never promises a prize. A pool is funded when we can fund one, so the wording
 * follows what the contract actually holds: with money in it the week is playing for a share,
 * and without it this is simply the leaderboard. Claiming a prize on a week we could not fund
 * would be a promise broken in public.
 */
export default function WeeklyBoard() {
  const { address } = useAccount();
  const [weekly, setWeekly] = useState<Weekly | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weekly")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setWeekly(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!weekly) return null;
  const pool = Number(weekly.prizePool);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      style={{ background: "#241C13", borderRadius: 20, padding: "clamp(16px,3vw,22px)", border: LINE }}>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "#CFE94B", textTransform: "uppercase" }}>
          This week
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557" }}>
          resets in {countdown(weekly.endsIn)}
        </div>
      </div>

      {weekly.funded ? (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px,6vw,34px)", color: "#CFE94B", lineHeight: 1 }}>
            {pool.toFixed(2)} <span style={{ fontSize: "clamp(13px,2.5vw,16px)", color: "#CBC0AE" }}>USDm</span>
          </div>
          <p style={{ fontSize: 12, color: "#CBC0AE", margin: "6px 0 0", lineHeight: 1.5 }}>
            Shared between the week&apos;s top players. Free to enter — just play.
          </p>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#CBC0AE", margin: "8px 0 0", lineHeight: 1.5 }}>
          Play to climb this week&apos;s board. When a prize pool is funded, the top players share it.
        </p>
      )}

      {weekly.rows.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          {weekly.rows.slice(0, 10).map((r, i) => {
            const isMe = !!address && r.playerId.toLowerCase() === address.toLowerCase();
            return (
              <div key={r.playerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < Math.min(weekly.rows.length, 10) - 1 ? LINE2 : undefined }}>
                <span style={{ width: 20, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: i < 3 ? "#F4C84B" : "#6E6557" }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: isMe ? "#CFE94B" : "#CBC0AE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.username}{isMe ? " (you)" : ""}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: isMe ? "#CFE94B" : "#F5EFE2" }}>
                  {r.points.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", marginTop: 12, marginBottom: 0 }}>
          No scores yet this week — play a round to open the board.
        </p>
      )}
    </motion.div>
  );
}
