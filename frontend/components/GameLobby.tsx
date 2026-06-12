"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ERC20_ABI, USDM_ADDRESS } from "@/lib/contracts";

const MIN_STAKE = 0.01;

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

  function validateStake(val: string) {
    const n = parseFloat(val);
    if (val && (isNaN(n) || n < 0)) setStakeError("Enter a valid amount");
    else if (n > 0 && n < MIN_STAKE) setStakeError("Minimum " + MIN_STAKE + " USDM");
    else setStakeError(null);
  }

  function handleStart() {
    if (stakeError) return;
    if (stakeBN > 0n) {
      setPendingStake(stakeBN); setStatus("Approving USDM...");
      approve({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [contract, stakeBN] });
    } else {
      setStatus("Starting round..."); start({ address: contract, abi: LEXIQ_ABI, functionName: "startRound", args: [0n] });
    }
  }

  useEffect(() => {
    if (approveOk && pendingStake > 0n && !startTx) {
      setStatus("Starting round..."); start({ address: contract, abi: LEXIQ_ABI, functionName: "startRound", args: [pendingStake] });
    }
  }, [approveOk]); // eslint-disable-line

  useEffect(() => {
    if (startOk && startReceipt) {
      const log = startReceipt.logs[0];
      if (log) { try { onEnterGame(BigInt(log.topics[1] || "0")); } catch { /**/ } }
    }
  }, [startOk, startReceipt]); // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">Prize Pool</p>
          <p className="text-base font-bold text-violet-400">{prizePool ? (Number(prizePool)/1e18).toFixed(2) : "0.00"} USDM</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">Your Best</p>
          <p className="text-base font-bold text-violet-300">{myHigh?.toString() ?? "0"} pts</p>
        </div>
      </div>
      {address && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-2xl p-3 text-center">
            <p className="text-[10px] text-gray-500 mb-1">Total Score</p>
            <p className="text-base font-bold text-gray-300">{myTotal?.toString() ?? "0"}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-3 text-center">
            <p className="text-[10px] text-gray-500 mb-1">Rounds Played</p>
            <p className="text-base font-bold text-gray-300">{played?.toString() ?? "0"}</p>
          </div>
        </div>
      )}
      <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
        <p className="font-semibold text-white">New Round</p>
        <div className="bg-violet-900/20 border border-violet-800/40 rounded-xl p-3 text-xs text-violet-300 space-y-1">
          <p>Get 7 random letters, build words in 90 seconds</p>
          <p>Commit words on-chain, reveal at the end</p>
          <p>Longer words score more points</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Optional stake (USDM)</p>
          <input value={stake} onChange={e => { setStake(e.target.value); validateStake(e.target.value); }}
            placeholder="0 = free to play" type="number" min="0" step="0.01" inputMode="decimal"
            className={"w-full bg-gray-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 " + (stakeError ? "border-red-500" : "border-gray-700")}
          />
          {stakeError
            ? <p className="text-xs text-red-400 mt-1">{stakeError}</p>
            : <p className="text-xs text-gray-600 mt-1">Score 10+ pts to get stake back (1% fee)</p>
          }
        </div>
        {status && <p className="text-xs text-yellow-400 animate-pulse">{status}</p>}
        <button onClick={handleStart} disabled={busy || !!stakeError}
          className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-bold">
          {busy ? (status ?? "Working...") : "Start Round"}
        </button>
      </div>
      {myRounds && myRounds.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-3">Recent Rounds</p>
          <div className="flex flex-wrap gap-2">
            {[...myRounds].reverse().slice(0, 6).map(id => (
              <button key={id.toString()} onClick={() => onEnterGame(id)}
                className="px-3 py-1.5 bg-gray-800 text-sm text-gray-300 rounded-lg hover:bg-gray-700">
                Round #{id.toString()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
