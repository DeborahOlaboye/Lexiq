"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";

const LINE = "1px solid var(--line)";
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

type Row = { addr: `0x${string}`; high: number };

export default function Leaderboard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const contract = LEXIQ_ADDRESS;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);

  const { data: prize } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "weeklyPrizePool" });
  const { data: myHigh } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore", args: address ? [address] : undefined });
  const { data: myTotal } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "totalScore", args: address ? [address] : undefined });
  const { data: played } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "gamesPlayed", args: address ? [address] : undefined });

  async function fetchLeaderboard() {
    if (!publicClient) return;
    setLoading(true);
    try {
      // How many rounds exist total?
      const totalCount = await publicClient.readContract({
        address: contract, abi: LEXIQ_ABI, functionName: "totalRounds",
      });
      const count = Number(totalCount as bigint);
      if (count === 0) { setRows([]); return; }

      // Read last 200 rounds to keep the multicall reasonable
      const start = Math.max(0, count - 200);
      const ids = Array.from({ length: count - start }, (_, i) => BigInt(start + i));

      const roundResults = await publicClient.multicall({
        contracts: ids.map((id) => ({
          address: contract, abi: LEXIQ_ABI,
          functionName: "getRound" as const, args: [id] as const,
        })),
      });

      // Collect unique players from finished rounds (state === 1)
      const seen = new Set<string>();
      const players: `0x${string}`[] = [];
      for (const r of roundResults) {
        if (r.status !== "success") continue;
        const [player, , , , , state] = r.result as unknown as [string, string, number, number, number, number, bigint, number];
        if (Number(state) === 1 && player && !seen.has(player.toLowerCase())) {
          seen.add(player.toLowerCase());
          players.push(player as `0x${string}`);
        }
      }

      if (players.length === 0) { setRows([]); return; }

      // Batch-read highScore for every unique player
      const scores = await publicClient.multicall({
        contracts: players.map((p) => ({
          address: contract, abi: LEXIQ_ABI,
          functionName: "highScore" as const, args: [p] as const,
        })),
      });

      const ranked: Row[] = players
        .map((addr, i) => ({
          addr,
          high: scores[i].status === "success" ? Number(scores[i].result) : 0,
        }))
        .filter((r) => r.high > 0)
        .sort((a, b) => b.high - a.high)
        .slice(0, 10);

      setRows(ranked);
    } catch (e) {
      console.error("leaderboard fetch error", e);
    } finally {
      setLoading(false);
      setLastFetch(Date.now());
    }
  }

  useEffect(() => {
    fetchLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient]);

  const prizeFormatted = prize ? (Number(prize) / 1e18).toFixed(2) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: "clamp(8px,2vw,16px)" }}>

      {/* Prize pool card */}
      <div style={{ borderRadius: 20, padding: "clamp(18px,4vw,26px)", textAlign: "center", background: "linear-gradient(135deg,rgba(207,233,75,.14),rgba(255,91,69,.08))", border: "1px solid rgba(207,233,75,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "#CFE94B", textTransform: "uppercase" }}>Weekly prize pool</div>
          <button onClick={fetchLeaderboard} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557", background: "none", border: "none", cursor: "pointer" }}>↻</button>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,8vw,44px)", color: "#CFE94B", lineHeight: 1, marginBottom: 4 }}>{prizeFormatted}</div>
        <div style={{ fontSize: 12, color: "#CBC0AE" }}>USDM</div>
      </div>

      {/* Your stats */}
      {address && (
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

      {/* High score list */}
      <div style={{ background: "#241C13", borderRadius: 18, overflow: "hidden", border: LINE }}>
        <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: LINE }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "#9A8C77", textTransform: "uppercase" }}>High scores</span>
          {lastFetch > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#6E6557" }}>
              updated {Math.round((Date.now() - lastFetch) / 1000)}s ago
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <span className="animate-blink" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#6E6557" }}>Loading…</span>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#9A8C77", fontSize: 14 }}>No rounds completed yet — be the first!</div>
        ) : (
          rows.map(({ addr, high }, i) => {
            const isMe = addr.toLowerCase() === address?.toLowerCase();
            return (
              <div key={addr} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < rows.length - 1 ? LINE : undefined, background: isMe ? "rgba(207,233,75,.07)" : undefined }}>
                <span style={{ width: 24, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: MEDALS[i] ?? "#9A8C77" }}>{i + 1}</span>
                <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13, color: isMe ? "#CFE94B" : "#CBC0AE" }}>
                  {addr.slice(0, 6)}…{addr.slice(-4)}{isMe ? " (you)" : ""}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: isMe ? "#CFE94B" : "#F5EFE2" }}>{high}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Scoring guide */}
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 9 }}>Scoring guide</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8 }}>
          {SCORING.map(({ label, pts, hot }) => (
            <div key={label} style={{ background: "#241C13", borderRadius: 11, padding: "clamp(8px,2vw,10px)", textAlign: "center", border: hot ? "1px solid rgba(255,91,69,.4)" : LINE }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: hot ? "#FF5B45" : "#9A8C77" }}>{label}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(16px,3.5vw,18px)", marginTop: 2, color: hot ? "#FF5B45" : "#CBC0AE" }}>{pts}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
