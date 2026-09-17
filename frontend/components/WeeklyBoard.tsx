"use client";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { awardBadge } from "@/lib/player";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

type Row = { playerId: string; username: string; points: number };
type Standing = { rank: number | null; points: number; total: number; toNext: number | null };
type Weekly = { week: string; endsIn: number; funded: boolean; prize: string | null; rows: Row[]; standing: Standing | null };

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
    fetch(address ? `/api/weekly?player=${address}` : "/api/weekly")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setWeekly(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [address]);

  useEffect(() => {
    if (!weekly || !address) return;
    // From the standing rather than the visible rows, which only ever held the top twenty.
    const rank = weekly.standing?.rank;
    if (rank && rank <= 10) awardBadge("top10");
  }, [weekly, address]);

  if (!weekly) return null;

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
            {weekly.prize}
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

      {/* What each band gets. A board where only the top three win teaches everyone else to

          stop trying, so the rewards are tiered and most of them cost nothing to give. */}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>

        {[

          { at: "Top 3", get: weekly.funded ? "share the pool" : "take the podium" },

          { at: "Top 10", get: "★ Weekly badge" },

          { at: "Everyone", get: "points toward your rank" },

        ].map(({ at, get }) => (

          <span key={at} style={{ display: "inline-flex", alignItems: "baseline", gap: 5, padding: "5px 9px", borderRadius: 9, background: "#1E1710", border: LINE2, fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77" }}>

            <b style={{ color: "#CBC0AE", fontWeight: 700 }}>{at}</b> {get}

          </span>

        ))}

      </div>


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

      {/* Where this player stands, whether or not they appear above. A rank alone is static;
          a gap is something one more round can close, and it is the only thing on this card
          that speaks to the player sitting in 24th. */}
      {weekly.standing && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: LINE2, fontFamily: "var(--font-mono)", fontSize: 12, color: "#CBC0AE", lineHeight: 1.5 }}>
          {weekly.standing.rank === null
            ? "You have not scored this week yet — one round puts you on the board."
            : weekly.standing.toNext === null
              ? `You are #1 this week with ${weekly.standing.points.toLocaleString()} points. Hold it.`
              : `You are #${weekly.standing.rank} of ${weekly.standing.total} — ${weekly.standing.toNext} ${weekly.standing.toNext === 1 ? "point" : "points"} from #${weekly.standing.rank - 1}.`}
        </div>
      )}
    </motion.div>
  );
}
