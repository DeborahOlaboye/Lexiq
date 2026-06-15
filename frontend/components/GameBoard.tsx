"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, scoreWord } from "@/lib/contracts";

const LINE = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

const CONFETTI = [
  { left: "12%", dur: "2.4s", delay: "0s",   color: "#CFE94B", round: false },
  { left: "28%", dur: "2.9s", delay: "0.3s", color: "#FF5B45", round: true  },
  { left: "44%", dur: "2.6s", delay: "0.6s", color: "#F5EFE2", round: false },
  { left: "62%", dur: "3.1s", delay: "0.15s",color: "#CFE94B", round: true  },
  { left: "78%", dur: "2.7s", delay: "0.5s", color: "#FF5B45", round: false },
  { left: "90%", dur: "3.3s", delay: "0.8s", color: "#F5EFE2", round: true  },
];

function randomSalt(): `0x${string}` {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return ("0x" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}
function hashWord(word: string, salt: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(["string", "bytes32"], [word.toUpperCase(), salt]));
}
function getLetterCounts(str: string) {
  const m: Record<string, number> = {};
  for (const c of str) m[c] = (m[c] || 0) + 1;
  return m;
}
function canBuild(word: string, letters: string) {
  const avail = getLetterCounts(letters);
  for (const c of word) { if (!avail[c]) return false; avail[c]--; }
  return true;
}

type WordEntry = { word: string; salt: `0x${string}`; pts: number };
type Pop = { id: number; text: string };

export default function GameBoard({
  roundId,
  onBack,
  onLeaderboard,
}: {
  roundId: bigint | null;
  onBack: () => void;
  onLeaderboard: () => void;
}) {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;
  const [input, setInput] = useState("");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [phase, setPhase] = useState<"active" | "done">("active");
  const [revealed, setRevealed] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [popId, setPopId] = useState(0);

  const { data: round, refetch } = useReadContract({
    address: contract, abi: LEXIQ_ABI, functionName: "getRound",
    args: roundId !== null ? [roundId] : undefined,
    query: { refetchInterval: 5000 },
  });
  const { data: letters } = useReadContract({
    address: contract, abi: LEXIQ_ABI, functionName: "getLetters",
    args: roundId !== null ? [roundId] : undefined,
    query: { enabled: roundId !== null },
  });
  const { data: myHigh } = useReadContract({
    address: contract, abi: LEXIQ_ABI, functionName: "highScore",
    args: address ? [address] : undefined,
  });

  const { writeContract: commit, data: commitTx } = useWriteContract();
  const { writeContract: reveal, isPending: revealPending } = useWriteContract();
  const { isLoading: commitPending } = useWaitForTransactionReceipt({ hash: commitTx });

  useEffect(() => {
    if (!round) return;
    if ((round as readonly unknown[])[5] === 1) setPhase("done");
  }, [round]);

  useEffect(() => {
    if (phase !== "active" || !round) return;
    const startedAt = Number((round as readonly unknown[])[2]);
    const end = startedAt + 90;
    const tick = () => setTimeLeft(Math.max(0, end - Math.floor(Date.now() / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, round]);

  const letterStr = letters
    ? (letters as readonly `0x${string}`[])
        .map((b) => String.fromCharCode(parseInt(b.slice(2), 16)))
        .join("")
    : "";

  const myScore = words.reduce((s, w) => s + w.pts, 0);
  const best = myHigh ? Number(myHigh) : 0;

  const submitWord = useCallback(() => {
    if (!roundId || phase !== "active" || timeLeft === 0 || commitPending) return;
    const word = input.trim().toUpperCase();
    if (word.length < 2 || !canBuild(word, letterStr) || words.find((w) => w.word === word)) return;
    const salt = randomSalt();
    const pts = scoreWord(word);
    commit({ address: contract, abi: LEXIQ_ABI, functionName: "commitWord", args: [roundId, hashWord(word, salt)] });
    setWords((prev) => [...prev, { word, salt, pts }]);
    setInput("");

    const id = popId + 1;
    setPopId(id);
    setPops((p) => [...p, { id, text: "+" + pts }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 950);
  }, [roundId, phase, timeLeft, input, words, letterStr, contract, commit, commitPending, popId]);

  function doReveal() {
    if (!roundId) return;
    reveal({
      address: contract, abi: LEXIQ_ABI, functionName: "revealWords",
      args: [roundId, words.map((w) => w.word), words.map((w) => w.salt)],
    });
    setRevealed(true);
    setTimeout(() => refetch(), 3000);
  }

  function tapTile(l: string) {
    if (phase !== "active" || timeLeft === 0) return;
    const avail = getLetterCounts(letterStr);
    const used = getLetterCounts(input);
    if ((used[l] || 0) < (avail[l] || 0)) setInput((prev) => prev + l);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
    if (val === "" || canBuild(val, letterStr)) setInput(val);
  }

  if (!roundId) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <p className="text-muted text-[14px]">No active round.</p>
      <button onClick={onBack} className="text-lime font-display font-bold text-sm">← Back to lobby</button>
    </div>
  );

  if (!round) return (
    <div className="flex items-center justify-center py-16">
      <p className="text-muted text-[14px] font-mono">Loading round…</p>
    </div>
  );

  const [,, , commitCount, finalScore, state, stake] = round as [
    `0x${string}`, `0x${string}`, number, number, number, number, bigint
  ];

  const isActive = state === 0 && timeLeft > 0 && phase === "active";
  const timeUp = timeLeft === 0 || phase === "done";
  const timerColor = phase !== "active"
    ? "#6E6557"
    : timeLeft > 30 ? "#F5EFE2" : timeLeft > 10 ? "#F4C84B" : "#FF5B45";
  const timeStr = String(Math.floor(timeLeft / 60)).padStart(2, "0") + ":" + String(timeLeft % 60).padStart(2, "0");
  const progress = best > 0 ? Math.min(100, Math.round((myScore / best) * 100)) : 0;
  const displayScore = state === 1 ? finalScore : myScore;
  const usedCounts = getLetterCounts(input);
  const availCounts = getLetterCounts(letterStr);

  return (
    <div className="flex flex-col gap-0 py-2">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={onBack} className="font-mono text-[12px] text-muted">‹ Back</button>
        {roundId && (
          <span className="font-mono text-[12px] text-muted2">Round #{roundId.toString()}</span>
        )}
      </div>

      {/* Stat strip */}
      <div className="flex gap-[9px] mb-3">
        {[
          { label: "Score", val: (
            <span
              key={displayScore}
              className="font-display font-extrabold text-[30px] text-lime leading-[1.05] inline-block"
              style={{ animation: displayScore > 0 ? "popScore .42s cubic-bezier(.2,1.5,.4,1)" : "none" }}
            >
              {displayScore}
            </span>
          )},
          { label: "Words", val: (
            <span className="font-display font-extrabold text-[30px] text-cream leading-[1.05]">
              {words.length}
            </span>
          )},
          { label: "Time", val: (
            <span className="font-mono font-bold text-[28px] leading-[1.12]" style={{ color: timerColor }}>
              {timeStr}
            </span>
          )},
        ].map(({ label, val }) => (
          <div
            key={label}
            className="flex-1 bg-panel rounded-[15px] p-[11px] text-center"
            style={{ border: LINE }}
          >
            <div className="font-mono text-[9px] tracking-[0.12em] text-muted uppercase">{label}</div>
            {val}
          </div>
        ))}
      </div>

      {/* Chasing best bar */}
      {best > 0 && (
        <div className="mb-3">
          <div className="flex justify-between font-mono text-[10px] text-muted mb-[5px]">
            <span>CHASING BEST</span>
            <span>{best} pts</span>
          </div>
          <div className="h-[7px] rounded-full bg-ink2 overflow-hidden" style={{ border: LINE }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: progress + "%", background: "linear-gradient(90deg, #CFE94B, #FF5B45)" }}
            />
          </div>
        </div>
      )}

      {/* Letter tiles */}
      {letterStr && (
        <div className="flex gap-[6px] justify-center flex-wrap mb-3">
          {letterStr.split("").map((l, i) => {
            const isUsed = (usedCounts[l] || 0) >= (availCounts[l] || 0) &&
              (usedCounts[l] || 0) > 0;
            return (
              <button
                key={i}
                onClick={() => tapTile(l)}
                disabled={isUsed || !isActive}
                className="w-[40px] h-[48px] rounded-[9px] bg-tile flex items-center justify-center font-display font-extrabold text-[25px] text-tileink transition-opacity"
                style={{
                  boxShadow: isUsed
                    ? "inset 0 -3px 0 #CFC1A6"
                    : "inset 0 -3px 0 #CFC1A6, 0 4px 10px rgba(0,0,0,.3)",
                  opacity: isUsed ? 0.3 : 1,
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      {/* Input + controls */}
      {isActive && (
        <div className="relative mb-3">
          <div className="flex gap-2 mb-[9px]">
            <input
              value={input}
              onChange={handleInput}
              onKeyDown={(e) => e.key === "Enter" && submitWord()}
              placeholder="Build a word…"
              disabled={commitPending}
              autoFocus
              className="flex-1 min-w-0 bg-ink2 rounded-[13px] px-[14px] py-[13px] font-display font-extrabold text-[18px] tracking-[0.14em] text-cream uppercase placeholder:text-muted2 placeholder:font-ui placeholder:font-normal placeholder:tracking-normal placeholder:text-[15px] placeholder:normal-case outline-none transition-colors"
              style={{ border: input.length >= 2 && canBuild(input, letterStr) ? "1px solid #CFE94B" : LINE2 }}
            />
            <button
              onClick={() => setInput((p) => p.slice(0, -1))}
              className="w-[48px] flex items-center justify-center bg-panel rounded-[13px] text-[18px] text-creamdim active:scale-95 transition-transform"
              style={{ border: LINE }}
            >
              ⌫
            </button>
          </div>

          {/* Submit button */}
          <button
            onClick={submitWord}
            disabled={commitPending || input.length < 2 || !canBuild(input, letterStr) || !!words.find((w) => w.word === input)}
            className="flex items-center justify-center gap-2 w-full py-[14px] rounded-[14px] bg-lime text-ink font-display font-extrabold text-[17px] disabled:opacity-40 transition-opacity active:translate-y-[3px]"
            style={{ boxShadow: commitPending ? "none" : "0 5px 0 #A9C931" }}
          >
            {commitPending
              ? "Committing…"
              : input.length >= 2 && canBuild(input, letterStr) && scoreWord(input) > 0
              ? `Submit  +${scoreWord(input)}`
              : "Submit"}
          </button>

          {/* Float-up pops */}
          {pops.map((p) => (
            <span
              key={p.id}
              className="animate-float-up absolute font-display font-extrabold text-[38px] text-lime pointer-events-none"
              style={{ left: "50%", top: 30, textShadow: "0 3px 12px rgba(0,0,0,.5)" }}
            >
              {p.text}
            </span>
          ))}
        </div>
      )}

      {/* Found words */}
      {words.length > 0 && isActive && (
        <div className="flex flex-wrap gap-[6px] mb-3">
          {words.map(({ word, pts }) => (
            <span
              key={word}
              className="inline-flex items-center gap-[5px] px-[11px] py-[7px] rounded-[10px] bg-panel font-display font-bold text-[13px] tracking-[0.04em] text-cream"
              style={{ border: LINE }}
            >
              {word}
              <b className={pts >= 8 ? "text-coral" : "text-lime"}>+{pts}</b>
            </span>
          ))}
        </div>
      )}

      {/* Time up — reveal */}
      {timeUp && state === 0 && !revealed && (
        <div className="bg-panel rounded-[20px] p-[24px] text-center" style={{ border: LINE }}>
          <div className="font-mono text-[12px] tracking-[0.18em] text-coral mb-2">TIME!</div>
          <div className="font-display font-extrabold text-[64px] text-lime leading-none">{myScore}</div>
          <div className="text-creamdim text-[14px] mt-1 mb-4">
            {words.length} word{words.length !== 1 ? "s" : ""} committed on-chain
          </div>
          {words.length > 0 && (
            <div className="flex flex-wrap gap-[6px] justify-center mb-4">
              {words.map(({ word, pts }) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-[5px] px-[11px] py-[7px] rounded-[10px] bg-ink2 font-display font-bold text-[13px] text-cream"
                  style={{ border: LINE }}
                >
                  {word} <b className={pts >= 8 ? "text-coral" : "text-lime"}>+{pts}</b>
                </span>
              ))}
            </div>
          )}
          <button
            onClick={doReveal}
            disabled={revealPending}
            className="w-full py-[14px] rounded-[14px] bg-lime text-ink font-display font-extrabold text-[17px] disabled:opacity-40"
            style={{ boxShadow: "0 5px 0 #A9C931" }}
          >
            {revealPending
              ? "Revealing…"
              : words.length > 0
              ? `Submit ${words.length} word${words.length !== 1 ? "s" : ""}`
              : "End round"}
          </button>
        </div>
      )}

      {/* Results */}
      {state === 1 && (
        <div className="relative rounded-[20px] overflow-hidden bg-ink" style={{ border: LINE }}>
          {/* Confetti */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="absolute top-0 w-[8px] h-[8px] confetti-piece"
                style={{
                  left: c.left,
                  "--dur": c.dur,
                  "--delay": c.delay,
                  background: c.color,
                  borderRadius: c.round ? "50%" : "2px",
                } as React.CSSProperties}
              />
            ))}
          </div>

          <div className="relative flex flex-col items-center text-center px-6 py-8">
            {finalScore > best && best > 0 && (
              <div
                className="inline-flex items-center gap-[7px] px-[15px] py-[7px] rounded-full bg-coral text-white font-display font-extrabold text-[13px] tracking-[0.1em] mb-4"
                style={{ boxShadow: "0 6px 18px rgba(255,91,69,.45)" }}
              >
                ★ NEW BEST!
              </div>
            )}
            <div
              key={finalScore}
              className="font-display font-extrabold text-[84px] text-lime leading-none"
              style={{ animation: "popScore .5s cubic-bezier(.2,1.5,.4,1)" }}
            >
              {finalScore}
            </div>
            <div className="font-display font-bold text-[18px] text-cream mt-1">points</div>
            {finalScore > best && best > 0 && (
              <div className="text-[14px] text-creamdim mt-2">
                Beat your old best of {best} by{" "}
                <b className="text-coral">+{finalScore - best}</b>
              </div>
            )}

            <div className="flex gap-[9px] mt-5 w-full">
              <div className="flex-1 bg-panel rounded-[14px] p-[13px]" style={{ border: LINE }}>
                <div className="font-mono text-[9px] tracking-[0.1em] text-muted uppercase">Words</div>
                <div className="font-display font-extrabold text-[24px]">{words.length}</div>
              </div>
              {words.length > 0 && (
                <div className="flex-[1.6] bg-panel rounded-[14px] p-[13px] text-left" style={{ border: LINE }}>
                  <div className="font-mono text-[9px] tracking-[0.1em] text-muted uppercase">Best word</div>
                  <div className="flex items-baseline gap-[7px]">
                    <span className="font-display font-extrabold text-[20px] tracking-[0.04em]">
                      {words.sort((a, b) => b.pts - a.pts)[0]?.word ?? "—"}
                    </span>
                    <span className="font-display font-extrabold text-coral text-[16px]">
                      +{words.sort((a, b) => b.pts - a.pts)[0]?.pts ?? 0}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {stake > 0n && (
              <div
                className="w-full mt-3 rounded-[14px] p-[14px] flex items-center justify-between"
                style={{
                  background: finalScore >= 10 ? "rgba(207,233,75,.12)" : "rgba(255,91,69,.12)",
                  border: finalScore >= 10 ? "1px solid rgba(207,233,75,.4)" : "1px solid rgba(255,91,69,.35)",
                }}
              >
                <span className="text-[13px] text-cream">
                  {finalScore >= 10 ? "Stake returned" : "Score under 10 — stake forfeited"}
                </span>
              </div>
            )}

            <button
              onClick={onBack}
              className="w-full mt-5 py-[16px] rounded-[15px] bg-lime text-ink font-display font-extrabold text-[17px]"
              style={{ boxShadow: "0 6px 0 #A9C931" }}
            >
              Play again
            </button>
            <div className="flex gap-[9px] w-full mt-[9px]">
              <button
                className="flex-1 py-[13px] rounded-[14px] text-cream font-display font-bold text-[14px]"
                style={{ border: LINE2 }}
              >
                Share result
              </button>
              <button
                onClick={onLeaderboard}
                className="flex-1 py-[13px] rounded-[14px] text-cream font-display font-bold text-[14px]"
                style={{ border: LINE2 }}
              >
                Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}

      {commitCount > 0 && state === 0 && (
        <p className="text-[11px] text-center text-muted2 font-mono mt-1">
          {commitCount} word{commitCount !== 1 ? "s" : ""} committed on-chain
        </p>
      )}
    </div>
  );
}
