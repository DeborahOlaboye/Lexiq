"use client";
import { useAccount, useReadContract } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";

export default function Leaderboard() {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;
  const { data: prize, refetch } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "weeklyPrizePool" });
  const { data: myHigh } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore", args: address ? [address] : undefined });
  const { data: played } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "gamesPlayed", args: address ? [address] : undefined });

  return (
    <div className="space-y-4">
      <div className="bg-violet-900/20 border border-violet-700 rounded-2xl p-4 text-center">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-violet-500 uppercase tracking-wide">Weekly Prize Pool</span>
          <button onClick={() => refetch()} className="text-xs text-gray-500">Refresh</button>
        </div>
        <p className="text-3xl font-bold text-violet-400">{prize ? (Number(prize)/1e18).toFixed(2) : "0.00"} USDM</p>
        <p className="text-xs text-gray-400 mt-1">Top scorers at week end share this</p>
      </div>
      {address && (
        <div className="bg-gray-900 rounded-2xl p-4 grid grid-cols-2 gap-3">
          <div className="text-center"><p className="text-xs text-gray-500">Your Best</p><p className="text-xl font-bold text-violet-400">{myHigh?.toString() ?? "0"} pts</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">Rounds</p><p className="text-xl font-bold text-gray-300">{played?.toString() ?? "0"}</p></div>
        </div>
      )}
    </div>
  );
}
