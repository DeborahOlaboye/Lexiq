"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";

const MIN_STAKE = 0.01;
const LINE = "1px solid var(--line)";

export default function GameLobby({ onEnterGame }: { onEnterGame: (roundId: bigint) => void }) {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;
  const [stake, setStake] = useState("");
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingStake, setPendingStake] = useState(0n);

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
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, stakeBN] });
    } else {
      setStatus("Starting round…");
      start({ address: contract, abi: LEXIQ_ABI, functionName: "startRound", args: [0n] });
    }
  }

  useEffect(() => {
    if (approveOk && pendingStake > 0n && !startTx) {
      setStatus("Starting round…");
      start({ address: contract, abi: LEXIQ_ABI, functionName: "startRound", args: [pendingStake] });
    }
  }, [approveOk]); // eslint-disable-line

  useEffect(() => {
    if (startOk && startReceipt) {
      const log = startReceipt.logs[0];
      if (log) { try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /**/ } }
    }
  }, [startOk, startReceipt]); // eslint-disable-line

  return (
    <div className="flex flex-col gap-[14px] py-2">

      {/* Hero start card */}
      <div className="bg-panel rounded-[22px] p-[22px]" style={{ border: LINE }}>
        <div className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">New round</div>
        <div className="font-display font-extrabold text-[30px] tracking-[-0.02em] mt-2 mb-1">Ready to race?</div>
        <div className="text-[14px] text-creamdim">7 letters · 90 seconds · longer words win</div>

        {/* Stake input */}
        <div className="mt-4">
          <div className="text-[13px] text-creamdim mb-2">Optional stake</div>
          <div
            className="flex items-center justify-between bg-ink2 rounded-[12px] px-[14px] py-[12px]"
            style={{ border: LINE }}
          >
            <input
              value={stake}
              onChange={(e) => { setStake(e.target.value); validateStake(e.target.value); }}
              placeholder="0 = free to play"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="flex-1 bg-transparent font-mono text-[14px] text-cream placeholder:text-muted2 outline-none"
            />
            <span className="font-mono text-[13px] text-creamdim ml-2">USDM</span>
          </div>
          {stakeError
            ? <p className="text-[11px] text-coral mt-2">{stakeError}</p>
            : <p className="text-[11px] text-muted2 mt-2">Score 10+ pts to get your stake back (1% fee)</p>
          }
        </div>

        {status && (
          <p className="text-[12px] text-lime font-mono mt-3 animate-pulse">{status}</p>
        )}

        <button
          onClick={handleStart}
          disabled={busy || !!stakeError}
          className="flex items-center justify-center gap-[10px] w-full py-[17px] rounded-[15px] bg-lime text-ink font-display font-extrabold text-[18px] mt-[18px] disabled:opacity-40 transition-opacity"
          style={{ boxShadow: busy ? "none" : "0 6px 0 #A9C931" }}
        >
          <span className="text-[13px]">▶</span>
          {busy ? (status ?? "Working…") : "Start round"}
        </button>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-[11px]">
        <StatCard label="Prize pool" value={prizeFormatted} unit="USDM" lime />
        <StatCard label="Your best" value={myHigh?.toString() ?? "—"} unit="pts" />
        <StatCard label="Total score" value={myTotal?.toString() ?? "—"} />
        <StatCard label="Rounds" value={played?.toString() ?? "—"} />
      </div>

      {/* Recent rounds */}
      {myRounds && myRounds.length > 0 && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-[9px]">Recent rounds</div>
          <div className="flex flex-wrap gap-2">
            {[...myRounds].reverse().slice(0, 6).map((id) => (
              <button
                key={id.toString()}
                onClick={() => onEnterGame(id)}
                className="px-[13px] py-2 rounded-[10px] bg-panel font-mono text-[12px] text-creamdim"
                style={{ border: LINE }}
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

function StatCard({
  label, value, unit, lime,
}: {
  label: string; value: string; unit?: string; lime?: boolean;
}) {
  return (
    <div className="bg-panel rounded-[16px] p-[14px]" style={{ border: "1px solid var(--line)" }}>
      <div className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{label}</div>
      <div className={`font-display font-extrabold text-[22px] mt-1 ${lime ? "text-lime" : "text-cream"}`}>
        {value}
      </div>
      {unit && <div className="text-[11px] text-muted2">{unit}</div>}
    </div>
  );
}
