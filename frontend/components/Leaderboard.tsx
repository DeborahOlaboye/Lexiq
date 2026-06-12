"use client";
import { useAccount, useReadContract } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";

const TOP = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
];

export default function Leaderboard() {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;
  const { data: prize, refetch: rp } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "weeklyPrizePool" });
  const { data: myHigh } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore", args: address ? [address] : undefined });
  const { data: myTotal } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "totalScore", args: address ? [address] : undefined });
  const { data: played } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "gamesPlayed", args: address ? [address] : undefined });

  const highs = TOP.map(addr =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore", args: [addr as `0x${string}`] })
  );
  const rows = TOP.map((addr, i) => ({ addr, high: highs[i]?.data ? Number(highs[i].data) : 0 })).sort((a, b) => b.high - a.high);
  const medals = ["1st", "2nd", "3rd"];

  return (
    <div className="space-y-4">
      <div className="bg-violet-900/20 border border-violet-700 rounded-2xl p-4 text-center">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-violet-500 uppercase tracking-wide">Weekly Prize Pool</span>
          <button onClick={() => rp()} className="text-xs text-gray-500 hover:text-gray-300">Refresh</button>
        </div>
        <p className="text-3xl font-bold text-violet-400">{prize ? (Number(prize)/1e18).toFixed(2) : "0.00"} USDM</p>
        <p className="text-xs text-gray-400 mt-1">Top scorers at week end share this</p>
      </div>
      {address && (
        <div className="bg-gray-900 rounded-2xl p-4 grid grid-cols-3 gap-3">
          <div className="text-center"><p className="text-xs text-gray-500">Best</p><p className="text-xl font-bold text-violet-400">{myHigh?.toString() ?? "0"}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold text-gray-300">{myTotal?.toString() ?? "0"}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">Rounds</p><p className="text-xl font-bold text-gray-300">{played?.toString() ?? "0"}</p></div>
        </div>
      )}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800"><p className="text-sm font-semibold text-white">High Score Leaderboard</p></div>
        {rows.every(r => r.high === 0) ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">No rounds played yet.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {rows.map(({ addr, high }, i) => (
              <div key={addr} className={"flex items-center gap-3 px-4 py-3 " + (addr.toLowerCase() === address?.toLowerCase() ? "bg-gray-800/50" : "")}>
                <span className="text-sm text-gray-500">{medals[i]}</span>
                <p className="flex-1 text-sm font-mono text-gray-300">{addr.slice(0,6)}...{addr.slice(-4)}{addr.toLowerCase() === address?.toLowerCase() && " (you)"}</p>
                <p className="text-white font-bold">{high} pts</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
        <p className="font-semibold text-white text-sm">Scoring Guide</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
          {[["2L","1 pt"],["3L","2 pts"],["4L","3 pts"],["5L","5 pts"],["6L","8 pts"],["7L+","11 pts"]].map(([l, p]) => (
            <div key={l} className="bg-gray-800 rounded-lg p-2 text-center"><p>{l}</p><p className="text-violet-400 font-bold">{p}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}
