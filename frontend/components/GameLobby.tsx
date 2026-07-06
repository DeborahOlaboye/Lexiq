"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";
import { celoFee } from "@/lib/minipay";

const MIN_STAKE = 0.01;
const LINE = "1px solid var(--line)";

export default function GameLobby({ onEnterGame }: { onEnterGame: (roundId: bigint) => void }) {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;
  const [stake, setStake] = useState("");
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingStake, setPendingStake] = useState(0n);
  const [showStake, setShowStake] = useState(false);

  const { data: prizePool } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "weeklyPrizePool" });
  const { data: myRounds } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "getPlayerRounds", args: address ? [address] : undefined });
  const { data: myHigh } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore", args: address ? [address] : undefined });
  const { data: myTotal } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "totalScore", args: address ? [address] : undefined });
  const { data: played } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "gamesPlayed", args: address ? [address] : undefined });

  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { writeContract: start, data: startTx } = useWriteContract();
  const { isSuccess: approveOk, isLoading: approving } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: startOk, isLoading: starting, data: startReceipt } = useWaitForTransactionReceipt({ hash: startTx });

  const stakeNum = parseFloat(stake) || 0;
  const stakeBN = stakeNum > 0 ? parseUnits(stakeNum.toFixed(18), 18) : 0n;
  const busy = approving || starting;
  const prizeFormatted = prizePool ? (Number(prizePool) / 1e18).toFixed(2) : "—";

  function validateStake(val: string) {
    const n = parseFloat(val);
    if (val && (isNaN(n) || n < 0)) setStakeError("Enter a valid amount");
    else if (n > 0 && n < MIN_STAKE) setStakeError("Minimum " + MIN_STAKE + " USDM");
    else setStakeError(null);
  }

  function handleStart() {
    if (stakeError) return;
    if (stakeBN > 0n) {
      setPendingStake(stakeBN);
      setStatus("Approving USDM…");
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, stakeBN], ...celoFee() } as any);
    } else {
      setStatus("Starting round…");
      start({ address: contract, abi: LEXIQ_ABI, functionName: "startRound", args: [0n], ...celoFee() } as any);
    }
  }

  useEffect(() => {
    if (approveOk && pendingStake > 0n && !startTx) {
      setStatus("Starting round…");
      start({ address: contract, abi: LEXIQ_ABI, functionName: "startRound", args: [pendingStake], ...celoFee() } as any);
    }
  }, [approveOk]); // eslint-disable-line

  useEffect(() => {
    if (startOk && startReceipt) {
      const log = startReceipt.logs[0];
      if (log) { try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /**/ } }
    }
  }, [startOk, startReceipt]); // eslint-disable-line

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: "clamp(8px,2vw,16px)" }}>

      {/* Hero start card */}
      <div className="animate-view-in" style={{ background: "#241C13", borderRadius: 22, padding: "clamp(18px,4vw,26px)", border: LINE }}>

        {/* Title row with FREE badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,4vw,30px)", letterSpacing: "-0.02em" }}>Ready to race?</div>
          <span style={{ flexShrink: 0, padding: "3px 9px", borderRadius: 8, background: "rgba(207,233,75,.15)", border: "1px solid rgba(207,233,75,.4)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color: "#CFE94B", letterSpacing: "0.1em" }}>FREE</span>
        </div>
        <div style={{ fontSize: 14, color: "#CBC0AE", marginBottom: 20 }}>7 letters · 90 seconds · longer words score higher</div>

        {/* Free play CTA */}
        {status && (
          <p style={{ fontSize: 12, color: "#CFE94B", fontFamily: "var(--font-mono)", marginBottom: 10, animation: "blink 1.4s infinite" }}>{status}</p>
        )}
        <button
          onClick={handleStart}
          disabled={busy || !!stakeError}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", padding: "clamp(14px,3vw,17px)",
            borderRadius: 15, border: "none",
            background: "#CFE94B", color: "#15110D",
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "clamp(16px,3vw,18px)",
            cursor: busy || !!stakeError ? "not-allowed" : "pointer",
            opacity: busy || !!stakeError ? 0.4 : 1,
            boxShadow: busy ? "none" : "0 6px 0 #A9C931",
            transition: "opacity 0.15s",
          }}
        >
          <span style={{ fontSize: 13 }}>▶</span>
          {busy ? (status ?? "Working…") : showStake && stakeNum > 0 ? `Play · Stake ${stakeNum} USDM` : "Play for Free"}
        </button>

        {/* Optional stake toggle */}
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => { setShowStake((v) => !v); if (showStake) { setStake(""); setStakeError(null); } }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557" }}>
              {showStake ? "▾ Hide stake" : "▸ Stake USDM for a bonus"}
            </span>
          </button>

          {showStake && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1E1710", borderRadius: 12, padding: "12px 14px", border: LINE }}>
                <input
                  value={stake}
                  onChange={(e) => { setStake(e.target.value); validateStake(e.target.value); }}
                  placeholder="e.g. 0.5"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  autoFocus
                  style={{ flex: 1, background: "transparent", fontFamily: "var(--font-mono)", fontSize: 14, color: "#F5EFE2", outline: "none", border: "none" }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#CBC0AE", marginLeft: 8 }}>USDM</span>
              </div>
              {stakeError
                ? <p style={{ fontSize: 11, color: "#FF5B45", marginTop: 6, marginBottom: 0 }}>{stakeError}</p>
                : <p style={{ fontSize: 11, color: "#6E6557", marginTop: 6, marginBottom: 0 }}>Score 10+ pts → stake returned minus 1% fee</p>
              }
            </div>
          )}
        </div>
      </div>

      {/* Stat grid — auto-fit 4-col on desktop, 2-col on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 11 }}>
        {[
          { label: "Prize pool", value: prizeFormatted, unit: "USDM", lime: true,  glow: true,  delay: 0.05 },
          { label: "Your best",  value: myHigh?.toString() ?? "—",   unit: "pts",  lime: false, glow: false, delay: 0.12 },
          { label: "Total score",value: myTotal?.toString() ?? "—",               lime: false, glow: false, delay: 0.19 },
          { label: "Rounds",     value: played?.toString() ?? "—",                lime: false, glow: false, delay: 0.26 },
        ].map(({ label, value, unit, lime, glow, delay }) => (
          <StatCard key={label} label={label} value={value} unit={unit} lime={lime} glow={glow} delay={delay} />
        ))}
      </div>

      {/* Recent rounds */}
      {myRounds && myRounds.length > 0 && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 9 }}>Recent rounds</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...myRounds].reverse().slice(0, 6).map((id) => (
              <button
                key={id.toString()}
                onClick={() => onEnterGame(id)}
                style={{ padding: "7px 13px", borderRadius: 10, background: "#241C13", fontFamily: "var(--font-mono)", fontSize: 12, color: "#CBC0AE", border: LINE, cursor: "pointer" }}
              >
                #{id.toString()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, lime, glow, delay = 0 }: { label: string; value: string; unit?: string; lime?: boolean; glow?: boolean; delay?: number }) {
  return (
    <div
      className={`animate-view-in${glow ? " animate-glow-lime" : ""}`}
      style={{ background: "#241C13", borderRadius: 16, padding: "clamp(12px,2.5vw,16px)", border: "1px solid var(--line)", animationDelay: `${delay}s` }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,3.5vw,22px)", marginTop: 4, color: lime ? "#CFE94B" : "#F5EFE2" }}>{value}</div>
      {unit && <div style={{ fontSize: 11, color: "#6E6557" }}>{unit}</div>}
    </div>
  );
}
