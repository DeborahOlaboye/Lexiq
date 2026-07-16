"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";
import { celoFee } from "@/lib/minipay";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayerStreak } from "@/hooks/usePlayerStreak";
import UsernamePrompt from "./UsernamePrompt";

const MIN_STAKE = 0.01;
const LINE = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

const DIFFICULTIES = [
  { label: "Easy",   value: 0, time: "120s", desc: "More time, common letters" },
  { label: "Normal", value: 1, time: "90s",  desc: "The classic Lexiq" },
  { label: "Hard",   value: 2, time: "60s",  desc: "Less time, tough letters" },
] as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.2, 1, 0.4, 1] as [number, number, number, number], delay },
});

export default function GameLobby({ onEnterGame }: { onEnterGame: (roundId: bigint) => void }) {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;
  const { streak, longestStreak, lastPlayedToday } = usePlayerStreak(address ?? undefined);
  const [stake, setStake]             = useState("");
  const [stakeError, setStakeError]   = useState<string | null>(null);
  const [status, setStatus]           = useState<string | null>(null);
  const [pendingStake, setPendingStake] = useState(0n);
  const [showStake, setShowStake]     = useState(false);
  const [difficulty, setDifficulty]   = useState<0 | 1 | 2>(1);
  const [showDiff, setShowDiff]       = useState(false);
  // Challenge: enter a round ID from a friend
  const [challengeId, setChallengeId] = useState("");
  const [showChallenge, setShowChallenge] = useState(false);

  const { data: prizePool } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "weeklyPrizePool" });
  const { data: myRounds }  = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "getPlayerRounds", args: address ? [address] : undefined });
  const { data: myHigh }    = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore",       args: address ? [address] : undefined });
  const { data: myTotal }   = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "totalScore",      args: address ? [address] : undefined });
  const { data: played }    = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "gamesPlayed",     args: address ? [address] : undefined });

  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { writeContract: start,   data: startTx   } = useWriteContract();
  const { isSuccess: approveOk, isLoading: approving } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: startOk, isLoading: starting, data: startReceipt } = useWaitForTransactionReceipt({ hash: startTx });

  const stakeNum = parseFloat(stake) || 0;
  const stakeBN  = stakeNum > 0 ? parseUnits(stakeNum.toFixed(18), 18) : 0n;
  const busy     = approving || starting;
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
      start({ address: contract, abi: LEXIQ_ABI, functionName: "startRound", args: [0n, difficulty], ...celoFee() } as any);
    }
  }

  function handleChallenge() {
    const id = BigInt(challengeId.trim());
    if (stakeBN > 0n) {
      setPendingStake(stakeBN);
      setStatus("Approving USDM…");
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, stakeBN], ...celoFee() } as any);
    } else {
      setStatus("Accepting challenge…");
      start({ address: contract, abi: LEXIQ_ABI, functionName: "startChallenge", args: [id, 0n], ...celoFee() } as any);
    }
  }

  useEffect(() => {
    if (approveOk && pendingStake > 0n && !startTx) {
      setStatus("Starting…");
      if (showChallenge && challengeId) {
        const id = BigInt(challengeId.trim());
        start({ address: contract, abi: LEXIQ_ABI, functionName: "startChallenge", args: [id, pendingStake], ...celoFee() } as any);
      } else {
        start({ address: contract, abi: LEXIQ_ABI, functionName: "startRound", args: [pendingStake, difficulty], ...celoFee() } as any);
      }
    }
  }, [approveOk]); // eslint-disable-line

  useEffect(() => {
    if (startOk && startReceipt) {
      const log = startReceipt.logs[0];
      if (log) { try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /**/ } }
    }
  }, [startOk, startReceipt]); // eslint-disable-line

  const diffLabel = DIFFICULTIES[difficulty].label;
  const diffTime  = DIFFICULTIES[difficulty].time;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: "clamp(8px,2vw,16px)" }}>

      {/* Streak banner */}
      <AnimatePresence>
        {streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.2, 1, 0.4, 1] as [number,number,number,number] }}
            style={{ borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
              background: lastPlayedToday ? "rgba(207,233,75,.08)" : "rgba(255,91,69,.08)",
              border: lastPlayedToday ? "1px solid rgba(207,233,75,.3)" : "1px solid rgba(255,91,69,.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <motion.span animate={{ scale: [1, 1.35, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} style={{ fontSize: 22 }}>🔥</motion.span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: lastPlayedToday ? "#CFE94B" : "#FF5B45" }}>
                  {streak}-day streak{streak >= 7 ? " 🏆" : ""}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77", marginTop: 2 }}>
                  {lastPlayedToday ? `Kept alive · best ever: ${longestStreak} days` : "⚠ Play today to keep your streak!"}
                </div>
              </div>
            </div>
            {!lastPlayedToday && (
              <motion.span animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.4, repeat: Infinity }}
                style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#FF5B45" }}>Play now →</motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero start card */}
      <motion.div {...fadeUp(0)} style={{ background: "#241C13", borderRadius: 22, padding: "clamp(18px,4vw,26px)", border: LINE }}>

        {/* Username prompt */}
        <div style={{ marginBottom: 14 }}>
          <UsernamePrompt />
        </div>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,4vw,30px)", letterSpacing: "-0.02em" }}>Ready to race?</div>
          <motion.span
            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8], boxShadow: ["0 0 0 0 rgba(207,233,75,0)", "0 0 10px 3px rgba(207,233,75,0.35)", "0 0 0 0 rgba(207,233,75,0)"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ flexShrink: 0, padding: "3px 9px", borderRadius: 8, background: "rgba(207,233,75,.15)", border: "1px solid rgba(207,233,75,.4)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color: "#CFE94B", letterSpacing: "0.1em" }}
          >FREE</motion.span>
        </div>
        <div style={{ fontSize: 14, color: "#CBC0AE", marginBottom: 18 }}>7 letters · {diffTime} · longer words score higher</div>

        {/* Difficulty picker */}
        <div style={{ marginBottom: 16 }}>
          <motion.button onClick={() => setShowDiff(v => !v)} whileHover={{ opacity: 0.8 }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77" }}>
              {showDiff ? "▾" : "▸"} Difficulty: <span style={{ color: difficulty === 0 ? "#CFE94B" : difficulty === 2 ? "#FF5B45" : "#F5EFE2" }}>{diffLabel}</span>
            </span>
          </motion.button>
          <AnimatePresence>
            {showDiff && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.2, 1, 0.4, 1] as [number,number,number,number] }}
                style={{ overflow: "hidden", marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DIFFICULTIES.map(({ label, value, time, desc }) => (
                  <motion.button key={value} onClick={() => { setDifficulty(value as 0|1|2); setShowDiff(false); }}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    style={{ flex: "1 1 80px", padding: "10px 12px", borderRadius: 12, border: difficulty === value ? `1px solid ${value === 0 ? "#CFE94B" : value === 2 ? "#FF5B45" : "rgba(245,239,226,.4)"}` : LINE,
                      background: difficulty === value ? "rgba(245,239,226,.06)" : "#1E1710", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: value === 0 ? "#CFE94B" : value === 2 ? "#FF5B45" : "#F5EFE2" }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", marginTop: 3 }}>{time} · {desc}</div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Play CTA */}
        {status && <p style={{ fontSize: 12, color: "#CFE94B", fontFamily: "var(--font-mono)", marginBottom: 10, animation: "blink 1.4s infinite" }}>{status}</p>}

        <AnimatePresence mode="wait">
          {!showChallenge ? (
            <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.button onClick={handleStart} disabled={busy || !!stakeError}
                animate={!busy && !stakeError ? { boxShadow: ["0 6px 0 #A9C931", "0 6px 24px rgba(207,233,75,0.6)", "0 6px 0 #A9C931"], y: [0, -3, 0] } : { boxShadow: "0 6px 0 #A9C931", y: 0 }}
                transition={!busy && !stakeError ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : {}}
                whileHover={!busy && !stakeError ? { scale: 1.03, y: -4 } : undefined}
                whileTap={!busy && !stakeError ? { scale: 0.97 } : undefined}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "clamp(14px,3vw,17px)", borderRadius: 15, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(16px,3vw,18px)", cursor: busy || !!stakeError ? "not-allowed" : "pointer", opacity: busy || !!stakeError ? 0.4 : 1 }}>
                <span style={{ fontSize: 13 }}>▶</span>
                {busy ? (status ?? "Working…") : showStake && stakeNum > 0 ? `Play · Stake ${stakeNum} USDM` : `Play for Free · ${diffLabel}`}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="challenge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", gap: 8 }}>
              <input value={challengeId} onChange={e => setChallengeId(e.target.value.replace(/\D/g, ""))}
                placeholder="Paste round ID…" inputMode="numeric"
                style={{ flex: 1, background: "#1E1710", border: LINE2, borderRadius: 12, padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 14, color: "#F5EFE2", outline: "none" }} />
              <motion.button onClick={handleChallenge} disabled={!challengeId || busy}
                whileHover={challengeId && !busy ? { scale: 1.04 } : undefined}
                whileTap={challengeId && !busy ? { scale: 0.96 } : undefined}
                style={{ padding: "12px 18px", borderRadius: 12, border: "none", background: challengeId && !busy ? "#CFE94B" : "#2F2517", color: challengeId && !busy ? "#15110D" : "#6E6557", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, cursor: challengeId && !busy ? "pointer" : "not-allowed" }}>
                Race!
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-row: stake toggle + challenge toggle */}
        <div style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <motion.button onClick={() => { setShowStake(v => !v); if (showStake) { setStake(""); setStakeError(null); } }} whileHover={{ opacity: 0.8 }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557" }}>
              {showStake ? "▾ Hide stake" : "▸ Stake USDM for a bonus"}
            </span>
          </motion.button>
          <motion.button onClick={() => setShowChallenge(v => !v)} whileHover={{ opacity: 0.8 }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557" }}>
              {showChallenge ? "▾ Cancel challenge" : "▸ Accept a challenge"}
            </span>
          </motion.button>
        </div>

        <AnimatePresence>
          {showStake && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.2, 1, 0.4, 1] as [number,number,number,number] }}
              style={{ overflow: "hidden", marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1E1710", borderRadius: 12, padding: "12px 14px", border: LINE }}>
                <input value={stake} onChange={e => { setStake(e.target.value); validateStake(e.target.value); }}
                  placeholder="e.g. 0.5" type="number" min="0" step="0.01" inputMode="decimal" autoFocus
                  style={{ flex: 1, background: "transparent", fontFamily: "var(--font-mono)", fontSize: 14, color: "#F5EFE2", outline: "none", border: "none" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#CBC0AE", marginLeft: 8 }}>USDM</span>
              </div>
              {stakeError
                ? <p style={{ fontSize: 11, color: "#FF5B45", marginTop: 6, marginBottom: 0 }}>{stakeError}</p>
                : <p style={{ fontSize: 11, color: "#6E6557", marginTop: 6, marginBottom: 0 }}>Score 10+ pts → stake returned minus 1% fee</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 11 }}>
        {[
          { label: "Prize pool", value: prizeFormatted, unit: "USDM", lime: true,  glow: true,  delay: 0.08 },
          { label: "Your best",  value: myHigh?.toString() ?? "—",   unit: "pts",  lime: false, glow: false, delay: 0.15 },
          { label: "Total score",value: myTotal?.toString() ?? "—",               lime: false, glow: false, delay: 0.22 },
          { label: "Rounds",     value: played?.toString() ?? "—",                lime: false, glow: false, delay: 0.29 },
        ].map(({ label, value, unit, lime, glow, delay }) => (
          <StatCard key={label} label={label} value={value} unit={unit} lime={lime} glow={glow} delay={delay} />
        ))}
      </div>

      {/* Recent rounds + share buttons */}
      {myRounds && myRounds.length > 0 && (
        <motion.div {...fadeUp(0.35)}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 9 }}>
            Recent rounds <span style={{ color: "#6E6557" }}>· tap to view · share to challenge a friend</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...myRounds].reverse().slice(0, 6).map((id, i) => (
              <RoundChip key={id.toString()} id={id} index={i} onEnter={onEnterGame} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function RoundChip({ id, index, onEnter }: { id: bigint; index: number; onEnter: (id: bigint) => void }) {
  const [copied, setCopied] = useState(false);

  function shareChallenge(e: React.MouseEvent) {
    e.stopPropagation();
    const text = `Challenge me on Lexiq! Use round #${id.toString()} — same 7 letters, beat my score 🎯\nhttps://lexiq.vercel.app`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
    }
  }

  return (
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 2.6 + index * 0.3, repeat: Infinity, ease: "easeInOut", delay: index * 0.25 }}
      style={{ display: "inline-flex", alignItems: "center", gap: 0, borderRadius: 10, overflow: "hidden", border: LINE2 }}
    >
      <motion.button onClick={() => onEnter(id)} whileHover={{ background: "#2F2517" }}
        style={{ padding: "7px 12px", background: "#241C13", fontFamily: "var(--font-mono)", fontSize: 12, color: "#CBC0AE", border: "none", cursor: "pointer" }}>
        #{id.toString()}
      </motion.button>
      <motion.button onClick={shareChallenge} whileHover={{ background: "rgba(207,233,75,.12)" }} whileTap={{ scale: 0.92 }} title="Share as challenge"
        style={{ padding: "7px 9px", background: "#1E1710", border: "none", borderLeft: LINE2, cursor: "pointer", fontSize: 12 }}>
        {copied ? "✓" : "⚔"}
      </motion.button>
    </motion.div>
  );
}

function StatCard({ label, value, unit, lime, glow, delay = 0 }: { label: string; value: string; unit?: string; lime?: boolean; glow?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 1, 0.4, 1] as [number, number, number, number], delay }}
      style={{ background: "#241C13", borderRadius: 16, padding: "clamp(12px,2.5vw,16px)", border: "1px solid var(--line)", animation: glow ? "glowLime 2.2s ease-in-out infinite" : undefined }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase" }}>{label}</div>
      <motion.div
        animate={lime ? { scale: [1, 1.07, 1], textShadow: ["0 0 0 rgba(207,233,75,0)", "0 0 14px rgba(207,233,75,0.55)", "0 0 0 rgba(207,233,75,0)"] } : { opacity: [0.75, 1, 0.75] }}
        transition={{ duration: lime ? 2.4 : 3.2, repeat: Infinity, ease: "easeInOut", delay }}
        style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,3.5vw,22px)", marginTop: 4, color: lime ? "#CFE94B" : "#F5EFE2" }}>
        {value}
      </motion.div>
      {unit && <div style={{ fontSize: 11, color: "#6E6557" }}>{unit}</div>}
    </motion.div>
  );
}
