"use client";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";

export default function GameLobby({ onEnterGame }: { onEnterGame: (roundId: bigint) => void }) {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;
  const [stake, setStake] = useState("");

  const { data: prizePool } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "weeklyPrizePool" });
  const { data: myHigh } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore", args: address ? [address] : undefined });
  const { data: played } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "gamesPlayed", args: address ? [address] : undefined });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">Prize Pool</p>
          <p className="text-base font-bold text-violet-400">{prizePool ? (Number(prizePool)/1e18).toFixed(2) : "0.00"} USDM</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">Best Score</p>
          <p className="text-base font-bold text-violet-300">{myHigh?.toString() ?? "0"} pts</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">Rounds</p>
          <p className="text-base font-bold text-gray-300">{played?.toString() ?? "0"}</p>
        </div>
      </div>
      <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
        <p className="font-semibold text-white">New Round</p>
        <input value={stake} onChange={e => setStake(e.target.value)}
          placeholder="Stake amount (USDM, optional)" type="number" min="0" step="0.01"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold">
          Start Round
        </button>
      </div>
    </div>
  );
}
