"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, scoreWord } from "@/lib/contracts";
import { celoFee } from "@/lib/minipay";

const LINE = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

const CONFETTI = [
  { left: "10%", dur: "2.4s", delay: "0s",    color: "#CFE94B", round: false },
  { left: "24%", dur: "2.9s", delay: "0.3s",  color: "#FF5B45", round: true  },
  { left: "40%", dur: "2.6s", delay: "0.6s",  color: "#F5EFE2", round: false },
  { left: "58%", dur: "3.1s", delay: "0.15s", color: "#CFE94B", round: true  },
  { left: "74%", dur: "2.7s", delay: "0.5s",  color: "#FF5B45", round: false },
  { left: "88%", dur: "3.3s", delay: "0.8s",  color: "#F5EFE2", round: true  },
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
    commit({ address: contract, abi: LEXIQ_ABI, functionName: "commitWord", args: [roundId, hashWord(word, salt)], ...celoFee() } as any);
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
      ...celoFee(),
    } as any);
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

  function shareResult(score: number) {
    const text = `I scored ${score} on Lexiq! 🎯 7 letters, 90 seconds, on Celo.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
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
  const isNewBest = finalScore > best && best > 0;
  const sortedWords = [...words].sort((a, b) => b.pts - a.pts);

  /* ── RESULTS SCREEN ── */
  if (state === 1) {
    return (
      <div className="animate-view-in" style={{ width: "min(560px, 100%)", margin: "0 auto", paddingTop: "clamp(12px,3vw,24px)" }}>
        <div className="relative rounded-[22px] overflow-hidden" style={{ background: "#1E1710", border: LINE }}>
          {/* Confetti */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="absolute top-0 w-[8px] h-[8px] confetti-piece"
                style={{ left: c.left, "--dur": c.dur, "--delay": c.delay, background: c.color, borderRadius: c.round ? "50%" : "2px" } as React.CSSProperties}
              />
            ))}
          </div>

          <div className="relative flex flex-col items-center text-center" style={{ padding: "clamp(24px,5vw,44px)" }}>
            {/* Badges */}
            <div className="flex flex-wrap gap-[8px] justify-center mb-4">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 20, background: "#241C13", border: LINE, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", color: "#F5EFE2", textTransform: "uppercase" }}>
                Round Complete
              </div>
              {isNewBest && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 20, background: "#FF5B45", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, letterSpacing: "0.1em", color: "white", boxShadow: "0 6px 18px rgba(255,91,69,.45)" }}>
                  ★ NEW BEST!
                </div>
              )}
            </div>

            {/* Score */}
            <div
              key={finalScore}
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(72px,16vw,96px)", color: "#CFE94B", lineHeight: 1, animation: "popScore .5s cubic-bezier(.2,1.5,.4,1)" }}
            >
              {finalScore}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#F5EFE2", marginTop: 4 }}>points</div>
            {isNewBest && (
              <div style={{ fontSize: 14, color: "#CBC0AE", marginTop: 8 }}>
                Beat your old best of {best} by <b style={{ color: "#FF5B45" }}>+{finalScore - best}</b>
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: "flex", gap: 10, marginTop: 20, width: "100%" }}>
              <div style={{ flex: 1, background: "#241C13", borderRadius: 14, padding: 14, border: LINE }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase" }}>Words</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "#F5EFE2", marginTop: 2 }}>{words.length}</div>
              </div>
              {sortedWords.length > 0 && (
                <div style={{ flex: 1.8, background: "#241C13", borderRadius: 14, padding: 14, border: LINE, textAlign: "left" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase" }}>Best word</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 2 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, letterSpacing: "0.04em" }}>{sortedWords[0].word}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#FF5B45" }}>+{sortedWords[0].pts}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Stake outcome */}
            {stake > 0n && (
              <div
                style={{
                  width: "100%", marginTop: 12, borderRadius: 14, padding: 14,
                  background: finalScore >= 10 ? "rgba(207,233,75,.10)" : "rgba(255,91,69,.10)",
                  border: finalScore >= 10 ? "1px solid rgba(207,233,75,.35)" : "1px solid rgba(255,91,69,.35)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 13, color: "#F5EFE2" }}>
                  {finalScore >= 10 ? "✓ Stake returned" : "✗ Score under 10 — stake forfeited"}
                </span>
              </div>
            )}

            {/* Found words scroll */}
            {words.length > 0 && (
              <div style={{ width: "100%", marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {sortedWords.map(({ word, pts }) => (
                  <span
                    key={word}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 10, background: "#241C13", border: LINE, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", color: "#F5EFE2" }}
                  >
                    {word} <b style={{ color: pts >= 8 ? "#FF5B45" : "#CFE94B" }}>+{pts}</b>
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <button
              onClick={onBack}
              style={{ width: "100%", marginTop: 20, padding: "clamp(13px,2.5vw,16px)", borderRadius: 15, background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2vw,17px)", boxShadow: "0 6px 0 #A9C931", border: "none", cursor: "pointer" }}
            >
              Play again
            </button>
            <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 10 }}>
              <button
                onClick={() => shareResult(finalScore)}
                style={{ flex: 1, padding: "clamp(11px,2vw,13px)", borderRadius: 14, background: "none", border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                Share result
              </button>
              <button
                onClick={onLeaderboard}
                style={{ flex: 1, padding: "clamp(11px,2vw,13px)", borderRadius: 14, background: "none", border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                Leaderboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── ACTIVE RACE LAYOUT ── */
  return (
    <div style={{ paddingTop: "clamp(8px,2vw,16px)" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77", background: "none", border: "none", cursor: "pointer", padding: 0 }}>‹ Back</button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557" }}>Round #{roundId.toString()}</span>
      </div>

      {/* Two-column flex: board + words panel */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>

        {/* LEFT: board */}
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>

          {/* Stat strip */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {[
              {
                label: "Score",
                val: (
                  <span
                    key={displayScore}
                    style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", color: "#CFE94B", lineHeight: 1.05, display: "inline-block", animation: displayScore > 0 ? "popScore .42s cubic-bezier(.2,1.5,.4,1)" : "none" }}
                  >
                    {displayScore}
                  </span>
                ),
              },
              {
                label: "Words",
                val: <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", color: "#F5EFE2", lineHeight: 1.05 }}>{words.length}</span>,
              },
              {
                label: "Time",
                val: <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "clamp(22px,4.5vw,28px)", lineHeight: 1.12, color: timerColor }}>{timeStr}</span>,
              },
            ].map(({ label, val }) => (
              <div key={label} style={{ flex: 1, background: "#241C13", borderRadius: 15, padding: "clamp(9px,2vw,12px) clamp(8px,2vw,12px)", textAlign: "center", border: LINE }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "#9A8C77", textTransform: "uppercase" }}>{label}</div>
                {val}
              </div>
            ))}
          </div>

          {/* Chasing best */}
          {best > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", marginBottom: 5 }}>
                <span>CHASING BEST</span>
                <span>{best} pts</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: "#1E1710", overflow: "hidden", border: LINE }}>
                <div style={{ height: "100%", borderRadius: 999, width: progress + "%", background: "linear-gradient(90deg, #CFE94B, #FF5B45)", transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {/* Letter tiles */}
          {letterStr && (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
              {letterStr.split("").map((l, i) => {
                const isUsed = (usedCounts[l] || 0) >= (availCounts[l] || 0) && (usedCounts[l] || 0) > 0;
                return (
                  <button
                    key={i}
                    onClick={() => tapTile(l)}
                    disabled={isUsed || !isActive}
                    style={{
                      width: "clamp(38px,8vw,46px)", height: "clamp(44px,9vw,54px)",
                      borderRadius: 9, background: "#F3ECDB", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-display)", fontWeight: 800,
                      fontSize: "clamp(22px,5vw,27px)", color: "#2A2017",
                      cursor: isUsed || !isActive ? "default" : "pointer",
                      opacity: isUsed ? 0.3 : 1,
                      boxShadow: isUsed
                        ? "inset 0 -3px 0 #CFC1A6"
                        : "inset 0 -3px 0 #CFC1A6, 0 4px 10px rgba(0,0,0,.3)",
                      transition: "opacity 0.15s",
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
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
                <input
                  value={input}
                  onChange={handleInput}
                  onKeyDown={(e) => e.key === "Enter" && submitWord()}
                  placeholder="Build a word…"
                  disabled={commitPending}
                  autoFocus
                  style={{
                    flex: 1, minWidth: 0,
                    background: "#1E1710",
                    borderRadius: 13,
                    padding: "clamp(11px,2vw,14px) clamp(12px,2vw,16px)",
                    fontFamily: "var(--font-display)", fontWeight: 800,
                    fontSize: "clamp(16px,3vw,18px)", letterSpacing: "0.14em",
                    color: "#F5EFE2", textTransform: "uppercase",
                    outline: "none",
                    border: input.length >= 2 && canBuild(input, letterStr) ? "1px solid #CFE94B" : LINE2,
                  }}
                />
                <button
                  onClick={() => setInput((p) => p.slice(0, -1))}
                  style={{ width: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "#241C13", border: LINE, borderRadius: 13, fontSize: 18, color: "#CBC0AE", cursor: "pointer" }}
                >
                  ⌫
                </button>
              </div>
              <button
                onClick={submitWord}
                disabled={commitPending || input.length < 2 || !canBuild(input, letterStr) || !!words.find((w) => w.word === input)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "clamp(12px,2.5vw,14px)",
                  borderRadius: 14, border: "none",
                  background: "#CFE94B", color: "#15110D",
                  fontFamily: "var(--font-display)", fontWeight: 800,
                  fontSize: "clamp(15px,2.5vw,17px)",
                  cursor: "pointer",
                  opacity: (commitPending || input.length < 2 || !canBuild(input, letterStr) || !!words.find((w) => w.word === input)) ? 0.4 : 1,
                  boxShadow: commitPending ? "none" : "0 5px 0 #A9C931",
                  transition: "opacity 0.15s",
                }}
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
                  className="animate-float-up absolute pointer-events-none"
                  style={{ left: "50%", top: 30, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 38, color: "#CFE94B", textShadow: "0 3px 12px rgba(0,0,0,.5)" }}
                >
                  {p.text}
                </span>
              ))}
            </div>
          )}

          {/* Time up — reveal */}
          {timeUp && state === 0 && !revealed && (
            <div style={{ background: "#241C13", borderRadius: 20, padding: "clamp(18px,4vw,24px)", textAlign: "center", border: LINE }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.18em", color: "#FF5B45", marginBottom: 8 }}>TIME!</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(52px,12vw,72px)", color: "#CFE94B", lineHeight: 1 }}>{myScore}</div>
              <div style={{ color: "#CBC0AE", fontSize: 14, marginTop: 6, marginBottom: 18 }}>
                {words.length} word{words.length !== 1 ? "s" : ""} committed on-chain
              </div>
              <button
                onClick={doReveal}
                disabled={revealPending}
                style={{ width: "100%", padding: "clamp(13px,2.5vw,16px)", borderRadius: 14, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2.5vw,17px)", boxShadow: "0 5px 0 #A9C931", cursor: revealPending ? "wait" : "pointer", opacity: revealPending ? 0.6 : 1 }}
              >
                {revealPending
                  ? "Revealing…"
                  : words.length > 0
                  ? `Submit ${words.length} word${words.length !== 1 ? "s" : ""} →`
                  : "End round"}
              </button>
            </div>
          )}

          {commitCount > 0 && state === 0 && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "center", color: "#6E6557", marginTop: 8 }}>
              {commitCount} word{commitCount !== 1 ? "s" : ""} committed on-chain
            </p>
          )}
        </div>

        {/* RIGHT: found words panel (visible during active play) */}
        {words.length > 0 && isActive && (
          <div style={{ flex: "1 1 220px", minWidth: 0, background: "#241C13", border: LINE, borderRadius: 18, padding: "clamp(12px,3vw,18px)", alignSelf: "flex-start" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 10 }}>Found words</div>
            {[...words].reverse().map(({ word, pts }) => (
              <div
                key={word}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: LINE }}
              >
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.04em", color: "#F5EFE2" }}>{word}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: pts >= 8 ? "#FF5B45" : "#CFE94B" }}>+{pts}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 6, borderTop: LINE2 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77" }}>TOTAL</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#CFE94B" }}>{myScore}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
