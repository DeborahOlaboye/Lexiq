"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI, scoreWord } from "@/lib/contracts";

export default function GameBoard({ roundId, onBack }: { roundId: bigint | null; onBack: () => void }) {
  const contract = LEXIQ_ADDRESS;
  const [timeLeft, setTimeLeft] = useState(90);

  const { data: round } = useReadContract({
    address: contract, abi: LEXIQ_ABI, functionName: "getRound",
    args: roundId !== null ? [roundId] : undefined,
    query: { refetchInterval: 5000 },
  });
  const { data: letters } = useReadContract({
    address: contract, abi: LEXIQ_ABI, functionName: "getLetters",
    args: roundId !== null ? [roundId] : undefined,
    query: { enabled: roundId !== null },
  });

  useEffect(() => {
    if (!round) return;
    const startedAt = Number((round as readonly unknown[])[2]);
    const end = startedAt + 90;
    const tick = () => setTimeLeft(Math.max(0, end - Math.floor(Date.now() / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [round]);

  const letterStr = letters
    ? (letters as readonly `0x${string}`[]).map(b => String.fromCharCode(parseInt(b.slice(2), 16))).join("") : "";

  if (!roundId) return <div className="text-center py-12"><p className="text-gray-400">No active round.</p><button onClick={onBack} className="mt-3 text-violet-400 text-sm">Lobby</button></div>;
  if (!round) return <div className="text-center py-12 text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-xs text-gray-500">Back</button>
      <div className="bg-gray-900 rounded-xl p-3 text-center">
        <p className="text-xs text-gray-500">Time</p>
        <p className="text-3xl font-bold font-mono text-green-400">
          {String(Math.floor(timeLeft/60)).padStart(2,"0")}:{String(timeLeft%60).padStart(2,"0")}
        </p>
      </div>
      <div className="bg-gray-900 rounded-2xl p-4">
        <p className="text-xs text-gray-500 mb-2">Letters</p>
        <div className="flex gap-1.5 justify-center">
          {letterStr.split("").map((l, i) => (
            <div key={i} className="w-10 h-10 bg-violet-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
