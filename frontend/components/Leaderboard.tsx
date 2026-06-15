"use client";
import { useAccount, useReadContract } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";

const LINE = "1px solid var(--line)";

const TOP = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
] as const;

const MEDALS = [
  { color: "#F4C84B" },
  { color: "#C9CBD1" },
  { color: "#CD8C5C" },
];

const SCORING = [
  ["2 L", "1",  false],
  ["3 L", "2",  false],
  ["4 L", "3",  false],
  ["5 L", "5",  false],
  ["6 L", "8",  true ],
  ["7 L+","11", true ],
] as const;

export default function Leaderboard() {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;

  const { data: prize, refetch: rp } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "weeklyPrizePool" });
  const { data: myHigh } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore", args: address ? [address] : undefined });
  const { data: myTotal } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "totalScore", args: address ? [address] : undefined });
  const { data: played } = useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "gamesPlayed", args: address ? [address] : undefined });

  const highs = TOP.map((addr) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReadContract({ address: contract, abi: LEXIQ_ABI, functionName: "highScore", args: [addr] })
  );

  const rows = TOP
    .map((addr, i) => ({ addr, high: highs[i]?.data ? Number(highs[i].data) : 0 }))
    .sort((a, b) => b.high - a.high);

  const prizeFormatted = prize ? (Number(prize) / 1e18).toFixed(2) : "—";

  return (
    <div className="flex flex-col gap-[14px] py-2">

      {/* Prize pool card */}
      <div
        className="rounded-[20px] p-5 text-center"
        style={{ background: "linear-gradient(135deg,rgba(207,233,75,.16),rgba(255,91,69,.10))", border: "1px solid rgba(207,233,75,.4)" }}
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="font-mono text-[10px] tracking-[0.14em] text-lime uppercase">Weekly prize pool</div>
          <button onClick={() => rp()} className="font-mono text-[10px] text-muted2 hover:text-muted transition-colors">
            ↻
          </button>
        </div>
        <div className="font-display font-extrabold text-[42px] text-lime leading-none mb-1">
          {prizeFormatted}
        </div>
        <div className="text-[12px] text-creamdim">USDM · top scorers split it</div>
        <div
          className="inline-flex items-center gap-[6px] mt-3 font-mono text-[12px] text-cream bg-ink2 px-3 py-[6px] rounded-full"
          style={{ border: LINE }}
        >
          <span className="w-[6px] h-[6px] rounded-full bg-coral animate-blink" />
          Resets in 3d 14h 22m
        </div>
      </div>

      {/* Your stats */}
      {address && (
        <div className="bg-panel rounded-[16px] p-4 grid grid-cols-3 gap-3" style={{ border: LINE }}>
          {[
            { label: "Best",   val: myHigh?.toString()  ?? "—", lime: true  },
            { label: "Total",  val: myTotal?.toString()  ?? "—", lime: false },
            { label: "Rounds", val: played?.toString()   ?? "—", lime: false },
          ].map(({ label, val, lime }) => (
            <div key={label} className="text-center">
              <div className="font-mono text-[10px] text-muted uppercase tracking-[0.1em]">{label}</div>
              <div className={`font-display font-extrabold text-[22px] mt-1 ${lime ? "text-lime" : "text-cream"}`}>
                {val}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* High score list */}
      <div className="bg-panel rounded-[18px] overflow-hidden" style={{ border: LINE }}>
        <div className="px-4 py-[13px] font-mono text-[10px] tracking-[0.12em] text-muted uppercase" style={{ borderBottom: LINE }}>
          High scores
        </div>
        {rows.every((r) => r.high === 0) ? (
          <div className="px-4 py-8 text-center text-muted text-[14px]">No rounds played yet.</div>
        ) : (
          rows.map(({ addr, high }, i) => {
            const isMe = addr.toLowerCase() === address?.toLowerCase();
            return (
              <div
                key={addr}
                className="flex items-center gap-3 px-4 py-[13px]"
                style={{
                  borderBottom: i < rows.length - 1 ? LINE : undefined,
                  background: isMe ? "rgba(207,233,75,.09)" : undefined,
                }}
              >
                <span
                  className="w-6 font-display font-extrabold text-[16px]"
                  style={{ color: MEDALS[i]?.color ?? "#9A8C77" }}
                >
                  {i + 1}
                </span>
                <span className={`flex-1 font-mono text-[13px] ${isMe ? "text-lime" : "text-creamdim"}`}>
                  {addr.slice(0, 6)}…{addr.slice(-4)}
                  {isMe && " (you)"}
                </span>
                <span className={`font-display font-extrabold text-[16px] ${isMe ? "text-lime" : "text-cream"}`}>
                  {high}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Scoring guide */}
      <div>
        <div className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-[9px]">Scoring guide</div>
        <div className="grid grid-cols-3 gap-2">
          {SCORING.map(([label, pts, hot]) => (
            <div
              key={label}
              className="bg-panel rounded-[11px] p-[9px] text-center"
              style={{ border: hot ? "1px solid rgba(255,91,69,.4)" : LINE }}
            >
              <div className={`font-mono text-[12px] ${hot ? "text-coral" : "text-muted"}`}>{label}</div>
              <div className={`font-display font-extrabold text-[18px] mt-[2px] ${hot ? "text-coral" : "text-creamdim"}`}>
                {pts}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
