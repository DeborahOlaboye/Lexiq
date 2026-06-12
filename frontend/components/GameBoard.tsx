"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, scoreWord } from "@/lib/contracts";

function randomSalt(): `0x${string}` {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return ("0x" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}
function hashWord(word: string, salt: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(["string", "bytes32"], [word.toUpperCase(), salt]));
}
type WordEntry = { word: string; salt: `0x${string}`; pts: number };

export default function GameBoard({ roundId, onBack }: { roundId: bigint | null; onBack: () => void }) {
  const { address } = useAccount();
  const contract = LEXIQ_ADDRESS;
  const [input, setInput] = useState("");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [phase, setPhase] = useState<"active" | "done">("active");
  const [revealed, setRevealed] = useState(false);

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
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [phase, round]);

  const letterStr = letters
    ? (letters as readonly `0x${string}`[]).map(b => String.fromCharCode(parseInt(b.slice(2), 16))).join("") : "";

  const submitWord = useCallback(() => {
    if (!roundId || phase !== "active" || timeLeft === 0 || commitPending) return;
    const word = input.trim().toUpperCase();
    if (word.length < 2 || words.find(w => w.word === word)) return;
    const salt = randomSalt();
    commit({ address: contract, abi: LEXIQ_ABI, functionName: "commitWord", args: [roundId, hashWord(word, salt)] });
    setWords(prev => [...prev, { word, salt, pts: scoreWord(word) }]);
    setInput("");
  }, [roundId, phase, timeLeft, input, words, contract, commit, commitPending]);

  function doReveal() {
    if (!roundId) return;
    reveal({ address: contract, abi: LEXIQ_ABI, functionName: "revealWords", args: [roundId, words.map(w => w.word), words.map(w => w.salt)] });
    setRevealed(true);
    setTimeout(() => refetch(), 3000);
  }

  if (!roundId) return <div className="text-center py-12"><p className="text-gray-400">No active round.</p><button onClick={onBack} className="mt-3 text-violet-400 text-sm">Lobby</button></div>;
  if (!round) return <div className="text-center py-12 text-gray-500 text-sm">Loading round...</div>;

  const [, , , commitCount, finalScore, state, stake] = round as [`0x${string}`, `0x${string}`, number, number, number, number, bigint];
  const myScore = words.reduce((s, w) => s + w.pts, 0);
  const isActive = state === 0 && timeLeft > 0 && phase === "active";
  const timeUp = timeLeft === 0 || phase === "done";
  const timerColor = timeLeft > 30 ? "text-green-400" : timeLeft > 10 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-500">Back</button>
        <span className="text-xs text-gray-600">Round #{roundId.toString()}</span>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 bg-gray-900 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Score</p><p className="text-2xl font-bold text-violet-400">{state === 1 ? finalScore : myScore}</p></div>
        <div className="flex-1 bg-gray-900 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Words</p><p className="text-2xl font-bold text-gray-300">{words.length}</p></div>
        <div className="flex-1 bg-gray-900 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Time</p>
          <p className={"text-2xl font-bold font-mono " + (isActive ? timerColor : "text-gray-500")}>
            {String(Math.floor(timeLeft/60)).padStart(2,"0")}:{String(timeLeft%60).padStart(2,"0")}
          </p>
        </div>
      </div>
      <div className="bg-gray-900 rounded-2xl p-4">
        <p className="text-xs text-gray-500 mb-2">Letters</p>
        <div className="flex gap-1.5 justify-center flex-wrap">
          {letterStr.split("").map((l, i) => <div key={i} className="w-10 h-10 bg-violet-700 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-lg">{l}</span></div>)}
        </div>
      </div>
      {isActive && (
        <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && submitWord()}
              placeholder={commitPending ? "Committing..." : "Type a word..."} disabled={commitPending} autoFocus
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white uppercase font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            />
            <button onClick={submitWord} disabled={commitPending} className="px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm disabled:opacity-50">
              +{input.length >= 2 ? scoreWord(input) : 0}
            </button>
          </div>
          {words.length > 0 && <div className="flex flex-wrap gap-1.5">{words.map(({ word, pts }) => <span key={word} className="text-xs bg-violet-900/40 text-violet-300 border border-violet-700/40 px-2 py-1 rounded-lg">{word} +{pts}</span>)}</div>}
        </div>
      )}
      {timeUp && state === 0 && !revealed && (
        <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
          <p className="font-semibold text-white">Time up! Submit your words.</p>
          {words.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5">{words.map(({ word, pts }) => <span key={word} className="text-xs bg-violet-900/40 text-violet-300 border border-violet-700/40 px-2 py-1 rounded-lg">{word} +{pts}</span>)}</div>
              <button onClick={doReveal} disabled={revealPending} className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold disabled:opacity-50">
                {revealPending ? "Revealing..." : "Submit " + words.length + " word" + (words.length !== 1 ? "s" : "")}
              </button>
            </>
          ) : (
            <div><p className="text-gray-500 text-sm">No words committed.</p><button onClick={doReveal} className="mt-2 text-xs text-gray-400">End round</button></div>
          )}
        </div>
      )}
      {state === 1 && (
        <div className={"rounded-xl p-4 text-center border " + (finalScore >= 10 ? "bg-green-900/30 border-green-600" : "bg-gray-900 border-gray-700")}>
          <p className="font-bold text-lg text-white">Round complete!</p>
          <p className="text-3xl font-bold text-violet-400 mt-1">{finalScore} pts</p>
          {stake > 0n && <p className={"text-sm mt-2 " + (finalScore >= 10 ? "text-green-400" : "text-red-400")}>{finalScore >= 10 ? "Stake returned" : "Score under 10 — stake forfeited to pool"}</p>}
          <button onClick={onBack} className="mt-3 text-sm bg-violet-600 text-white px-4 py-2 rounded-xl font-bold">Play again</button>
        </div>
      )}
      {commitCount > 0 && state === 0 && <p className="text-xs text-center text-gray-600">{commitCount} word(s) committed on-chain</p>}
    </div>
  );
}
