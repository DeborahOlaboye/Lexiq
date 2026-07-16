"use client";
import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { keccak256, encodePacked } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, scoreWord } from "@/lib/contracts";
import { celoFee } from "@/lib/minipay";
import { wagmiConfig } from "@/lib/wagmi";
import { isValidWord, validateWords } from "@/lib/dictionary";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUsername, displayName } from "@/lib/player";
import { submitScore } from "@/hooks/usePlayerStreak";

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
  const [pops, setPops] = useState<Pop[]>([]);
  const [popId, setPopId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wordValid, setWordValid] = useState<"valid" | "invalid" | "unchecked">("unchecked");

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

  const letterStr = letters
    ? (letters as readonly `0x${string}`[])
        .map((b) => String.fromCharCode(parseInt(b.slice(2), 16)))
        .join("")
    : "";

  // Reset all transient state when a new round begins
  useEffect(() => {
    setPhase("active");
    setTimeLeft(90);
    setWords([]);
    setInput("");
    setSubmitting(false);
    setSubmitProgress(null);
    setSubmitError(null);
    setPops([]);
    setWordValid("unchecked");
  }, [roundId]);

  // Debounced async dictionary check whenever input changes
  useEffect(() => {
    const w = input.trim().toUpperCase();
    if (w.length < 2 || !canBuild(w, letterStr)) { setWordValid("unchecked"); return; }
    setWordValid("unchecked");
    const t = setTimeout(async () => {
      const ok = await isValidWord(w);
      setWordValid(ok ? "valid" : "invalid");
    }, 250);
    return () => clearTimeout(t);
  }, [input, letterStr]);

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

  // Single tap: commit all words then reveal
  async function doSubmit() {
    if (!roundId || submitting || words.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Re-validate every word against the dictionary before touching the chain.
      // This catches anything that slipped in while the debounce was in-flight.
      setSubmitProgress("Checking words…");
      const validSet = await validateWords(words.map((w) => w.word));
      const validWords = words.filter((w) => validSet.has(w.word.toUpperCase()));
      if (validWords.length === 0) {
        setSubmitError("No valid dictionary words to submit.");
        setSubmitProgress(null);
        setSubmitting(false);
        return;
      }
      // Use only validated words from here on
      const wordsToSubmit = validWords;

      // Step 1 — commit all hashes in one tx (no time restriction on new contract)
      setSubmitProgress(`Committing ${wordsToSubmit.length} word${wordsToSubmit.length !== 1 ? "s" : ""}…`);
      const hashes = wordsToSubmit.map((w) => hashWord(w.word, w.salt));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const commitHash = await (writeContract as any)(wagmiConfig, {
        address: contract, abi: LEXIQ_ABI, functionName: "commitWords",
        args: [roundId, hashes],
        ...celoFee(),
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: commitHash });

      // Step 2 — reveal
      setSubmitProgress("Revealing…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const revealHash = await (writeContract as any)(wagmiConfig, {
        address: contract, abi: LEXIQ_ABI, functionName: "revealWords",
        args: [roundId, wordsToSubmit.map((w) => w.word), wordsToSubmit.map((w) => w.salt)],
        ...celoFee(),
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: revealHash });
      setSubmitProgress(null);
      // Submit to shared leaderboard (username, score)
      const finalPts = validWords.reduce((s, w) => s + w.pts, 0);
      if (address) submitScore({ playerId: address, username: getStoredUsername() ?? displayName(address), score: finalPts });
      setTimeout(() => refetch(), 1000);
    } catch {
      setSubmitError("Transaction failed — tap to retry.");
      setSubmitProgress(null);
    } finally {
      setSubmitting(false);
    }
  }

  const myScore = words.reduce((s, w) => s + w.pts, 0);
  const best = myHigh ? Number(myHigh) : 0;
  const progress = best > 0 ? Math.min(100, Math.round((myScore / best) * 100)) : 0;
  const usedCounts = getLetterCounts(input);
  const availCounts = getLetterCounts(letterStr);
  const timeStr = String(Math.floor(timeLeft / 60)).padStart(2, "0") + ":" + String(timeLeft % 60).padStart(2, "0");
  const timerColor = phase !== "active"
    ? "#6E6557"
    : timeLeft > 30 ? "#F5EFE2" : timeLeft > 10 ? "#F4C84B" : "#FF5B45";
  const isActive = phase === "active" && timeLeft > 0 && !submitting;
  const timeUp = (timeLeft === 0 || phase === "done");

  const submitWord = useCallback(() => {
    if (!isActive || !roundId) return;
    const word = input.trim().toUpperCase();
    if (word.length < 2 || !canBuild(word, letterStr) || words.find((w) => w.word === word) || wordValid !== "valid") return;
    const salt = randomSalt();
    const pts = scoreWord(word);
    setWords((prev) => [...prev, { word, salt, pts }]);
    setInput("");
    const id = popId + 1;
    setPopId(id);
    setPops((p) => [...p, { id, text: "+" + pts }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 950);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, roundId, input, words, letterStr, popId, wordValid]);

  function tapTile(l: string) {
    if (!isActive) return;
    const avail = getLetterCounts(letterStr);
    const used = getLetterCounts(input);
    if ((used[l] || 0) < (avail[l] || 0)) setInput((prev) => prev + l);
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
      <p style={{ fontSize: 14, color: "#9A8C77" }}>No active round.</p>
      <button onClick={onBack} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "#CFE94B", background: "none", border: "none", cursor: "pointer" }}>← Back to lobby</button>
    </div>
  );
  if (!round) return (
    <div className="flex items-center justify-center py-16">
      <p style={{ fontSize: 14, color: "#9A8C77", fontFamily: "var(--font-mono)" }}>Loading round…</p>
    </div>
  );

  const [,, , , finalScore, state, stake] = round as unknown as [
    `0x${string}`, `0x${string}`, number, number, number, number, bigint, number
  ];
  const isNewBest = finalScore > best && best > 0;
  const sortedWords = [...words].sort((a, b) => b.pts - a.pts);
  const displayScore = state === 1 ? finalScore : myScore;

  /* ── RESULTS ── */
  if (state === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 1, 0.4, 1] }}
        style={{ width: "min(560px, 100%)", margin: "0 auto", paddingTop: "clamp(12px,3vw,24px)" }}
      >
        <div className="relative rounded-[22px] overflow-hidden" style={{ background: "#1E1710", border: LINE }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {CONFETTI.map((c, i) => (
              <span key={i} className="absolute top-0 w-[8px] h-[8px] confetti-piece"
                style={{ left: c.left, "--dur": c.dur, "--delay": c.delay, background: c.color, borderRadius: c.round ? "50%" : "2px" } as React.CSSProperties} />
            ))}
          </div>
          <div className="relative flex flex-col items-center text-center" style={{ padding: "clamp(24px,5vw,44px)" }}>
            <div className="flex flex-wrap gap-[8px] justify-center mb-4">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 20, background: "#241C13", border: LINE, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", color: "#F5EFE2", textTransform: "uppercase" }}>Round Complete</div>
              {isNewBest && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 20, background: "#FF5B45", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, letterSpacing: "0.1em", color: "white", boxShadow: "0 6px 18px rgba(255,91,69,.45)" }}>★ NEW BEST!</div>
              )}
            </div>
            <div key={finalScore} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(72px,16vw,96px)", color: "#CFE94B", lineHeight: 1, animation: "popScore .5s cubic-bezier(.2,1.5,.4,1)" }}>{finalScore}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#F5EFE2", marginTop: 4 }}>points</div>
            {isNewBest && <div style={{ fontSize: 14, color: "#CBC0AE", marginTop: 8 }}>Beat your old best of {best} by <b style={{ color: "#FF5B45" }}>+{finalScore - best}</b></div>}
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
            {stake > 0n && (
              <div style={{ width: "100%", marginTop: 12, borderRadius: 14, padding: 14, background: finalScore >= 10 ? "rgba(207,233,75,.10)" : "rgba(255,91,69,.10)", border: finalScore >= 10 ? "1px solid rgba(207,233,75,.35)" : "1px solid rgba(255,91,69,.35)" }}>
                <span style={{ fontSize: 13, color: "#F5EFE2" }}>{finalScore >= 10 ? "✓ Stake returned" : "✗ Score under 10 — stake forfeited"}</span>
              </div>
            )}
            {sortedWords.length > 0 && (
              <div style={{ width: "100%", marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {sortedWords.map(({ word, pts }) => (
                  <span key={word} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 10, background: "#241C13", border: LINE, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", color: "#F5EFE2" }}>
                    {word} <b style={{ color: pts >= 8 ? "#FF5B45" : "#CFE94B" }}>+{pts}</b>
                  </span>
                ))}
              </div>
            )}
            <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }} onClick={onBack} style={{ width: "100%", marginTop: 20, padding: "clamp(13px,2.5vw,16px)", borderRadius: 15, background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2vw,17px)", boxShadow: "0 6px 0 #A9C931", border: "none", cursor: "pointer" }}>Play again</motion.button>
            <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 10 }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => shareResult(finalScore)} style={{ flex: 1, padding: "clamp(11px,2vw,13px)", borderRadius: 14, background: "none", border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Share result</motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onLeaderboard} style={{ flex: 1, padding: "clamp(11px,2vw,13px)", borderRadius: 14, background: "none", border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Leaderboard</motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── ACTIVE RACE ── */
  return (
    <div style={{ paddingTop: "clamp(8px,2vw,16px)" }}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77", background: "none", border: "none", cursor: "pointer", padding: 0 }}>‹ Back</button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557" }}>Round #{roundId.toString()}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>

        {/* LEFT: board */}
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>

          {/* Stat strip */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Score", val: <motion.span
                  key={displayScore}
                  initial={displayScore > 0 ? { scale: 1.4 } : { scale: 1 }}
                  animate={displayScore > 0 ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={displayScore > 0 ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : {}}
                  style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", color: "#CFE94B", lineHeight: 1.05, display: "inline-block" }}>
                  {displayScore}
                </motion.span> },
              { label: "Words", val: <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", color: "#F5EFE2", lineHeight: 1.05 }}>{words.length}</span> },
              { label: "Time",  val: <motion.span
                  animate={phase === "active" && timeLeft > 0
                    ? { scale: timeLeft <= 10 ? [1, 1.14, 1] : [1, 1.04, 1] }
                    : { scale: 1 }}
                  transition={phase === "active" && timeLeft > 0
                    ? { duration: timeLeft <= 10 ? 0.6 : 1.8, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.2 }}
                  style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "clamp(22px,4.5vw,28px)", lineHeight: 1.12, color: timerColor, display: "inline-block" }}>
                  {timeStr}
                </motion.span> },
            ].map(({ label, val }) => (
              <div key={label} style={{ flex: 1, background: "#241C13", borderRadius: 15, padding: "clamp(9px,2vw,12px)", textAlign: "center", border: LINE }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "#9A8C77", textTransform: "uppercase" }}>{label}</div>
                {val}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {best > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", marginBottom: 5 }}>
                <span>CHASING BEST</span><span>{best} pts</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: "#1E1710", overflow: "hidden", border: LINE }}>
                <div style={{ height: "100%", borderRadius: 999, width: progress + "%", background: "linear-gradient(90deg, #CFE94B, #FF5B45)", transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {/* Letter tiles */}
          {letterStr && (
            <div key={letterStr} style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
              {letterStr.split("").map((l, i) => {
                const isUsed = (usedCounts[l] || 0) >= (availCounts[l] || 0) && (usedCounts[l] || 0) > 0;
                const disabled = isUsed || !isActive;
                return (
                  // outer: continuous bob float
                  <motion.div
                    key={i}
                    animate={{ y: disabled ? 0 : [0, -6, 0] }}
                    transition={disabled
                      ? { duration: 0.3 }
                      : { duration: 2.2 + i * 0.28, repeat: Infinity, ease: "easeInOut", delay: i * 0.21 }}
                    style={{ display: "inline-flex" }}
                  >
                    {/* inner: entrance + tap */}
                    <motion.button
                      onClick={() => tapTile(l)}
                      disabled={disabled}
                      initial={{ opacity: 0, scale: 0.72, rotate: -10 }}
                      animate={{ opacity: disabled ? 0.3 : 1, scale: 1, rotate: 0 }}
                      transition={{ duration: 0.4, ease: [0.2, 1.4, 0.4, 1], delay: i * 0.07 }}
                      whileHover={!disabled ? { scale: 1.15 } : undefined}
                      whileTap={!disabled ? { scale: 0.84 } : undefined}
                      style={{ width: "clamp(38px,8vw,46px)", height: "clamp(44px,9vw,54px)", borderRadius: 9, background: "#F3ECDB", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,5vw,27px)", color: "#2A2017", cursor: disabled ? "default" : "pointer", boxShadow: disabled ? "inset 0 -3px 0 #CFC1A6" : "inset 0 -3px 0 #CFC1A6, 0 4px 10px rgba(0,0,0,.3)" }}
                    >
                      {l}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Input — only while active */}
          {isActive && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                    if (val === "" || canBuild(val, letterStr)) setInput(val);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && submitWord()}
                  placeholder="Build a word…" autoFocus
                  style={{ flex: 1, minWidth: 0, background: "#1E1710", borderRadius: 13, padding: "clamp(11px,2vw,14px) clamp(12px,2vw,16px)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(16px,3vw,18px)", letterSpacing: "0.14em", color: "#F5EFE2", textTransform: "uppercase", outline: "none", border: wordValid === "valid" ? "1px solid #CFE94B" : wordValid === "invalid" ? "1px solid rgba(255,91,69,.6)" : LINE2 }}
                />
                <motion.button
                  onClick={() => setInput((p) => p.slice(0, -1))}
                  animate={input.length > 0 ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.4 }}
                  transition={input.length > 0 ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : {}}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.88 }}
                  style={{ width: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "#241C13", border: LINE, borderRadius: 13, fontSize: 18, color: "#CBC0AE", cursor: "pointer" }}>⌫</motion.button>
              </div>
              <AnimatePresence mode="wait">
                {input.length >= 2 && wordValid !== "unchecked" && (
                  <motion.div
                    key={wordValid}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 6, paddingLeft: 4, color: wordValid === "valid" ? "#CFE94B" : "#FF5B45" }}
                  >
                    {wordValid === "valid" ? "✓ Valid word" : "✗ Not in dictionary"}
                  </motion.div>
                )}
              </AnimatePresence>
              {(() => {
                const submitDisabled = input.length < 2 || !canBuild(input, letterStr) || !!words.find((w) => w.word === input) || wordValid !== "valid";
                return (
                  <motion.button
                    onClick={submitWord}
                    disabled={submitDisabled}
                    animate={!submitDisabled ? { boxShadow: ["0 5px 0 #A9C931", "0 5px 22px rgba(207,233,75,0.55)", "0 5px 0 #A9C931"] } : { boxShadow: "none" }}
                    transition={!submitDisabled ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                    whileHover={!submitDisabled ? { scale: 1.02, y: -2 } : undefined}
                    whileTap={!submitDisabled ? { scale: 0.97 } : undefined}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "clamp(12px,2.5vw,14px)", borderRadius: 14, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2.5vw,17px)", cursor: submitDisabled ? "default" : "pointer", opacity: submitDisabled ? 0.4 : 1 }}>
                    {wordValid === "invalid"
                      ? "Not a word"
                      : input.length >= 2 && canBuild(input, letterStr) && scoreWord(input) > 0
                      ? `Submit  +${scoreWord(input)}`
                      : "Submit"}
                  </motion.button>
                );
              })()}
              {pops.map((p) => (
                <span key={p.id} className="animate-float-up absolute pointer-events-none"
                  style={{ left: "50%", top: 30, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 38, color: "#CFE94B", textShadow: "0 3px 12px rgba(0,0,0,.5)" }}>
                  {p.text}
                </span>
              ))}
            </div>
          )}

          {/* Time-up panel */}
          <AnimatePresence>
            {timeUp && state !== 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.2, 1, 0.4, 1] }}
                style={{ background: "#241C13", borderRadius: 20, padding: "clamp(18px,4vw,24px)", textAlign: "center", border: LINE }}
              >
                <motion.div
                  animate={{ scale: [1, 1.07, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.18em", color: "#FF5B45", marginBottom: 8 }}
                >TIME!</motion.div>
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(52px,12vw,72px)", color: "#CFE94B", lineHeight: 1 }}
                >{myScore}</motion.div>
                <div style={{ color: "#CBC0AE", fontSize: 14, marginTop: 6, marginBottom: 18 }}>
                  {words.length} word{words.length !== 1 ? "s" : ""} · {myScore} point{myScore !== 1 ? "s" : ""}
                </div>
                {submitError && <p style={{ fontSize: 12, color: "#FF5B45", fontFamily: "var(--font-mono)", marginBottom: 10 }}>{submitError}</p>}
                {words.length === 0 ? (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onBack} style={{ width: "100%", padding: "clamp(13px,2.5vw,16px)", borderRadius: 14, border: "none", background: "#2F2517", color: "#9A8C77", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2.5vw,17px)", cursor: "pointer" }}>Back to lobby</motion.button>
                ) : (
                  <motion.button
                    whileHover={!submitting ? { scale: 1.02, y: -2 } : undefined}
                    whileTap={!submitting ? { scale: 0.97 } : undefined}
                    onClick={doSubmit} disabled={submitting}
                    style={{ width: "100%", padding: "clamp(13px,2.5vw,16px)", borderRadius: 14, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2.5vw,17px)", boxShadow: submitting ? "none" : "0 5px 0 #A9C931", cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? (submitProgress ?? "Working…") : `Submit ${words.length} word${words.length !== 1 ? "s" : ""} →`}
                  </motion.button>
                )}
                {submitting && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77", marginTop: 10 }}>Keep this tab open</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: found words */}
        <AnimatePresence>
          {words.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              style={{ flex: "1 1 220px", minWidth: 0, background: "#241C13", border: LINE, borderRadius: 18, padding: "clamp(12px,3vw,18px)", alignSelf: "flex-start" }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 10 }}>Found words</div>
              <AnimatePresence initial={false}>
                {[...words].reverse().map(({ word, pts }) => (
                  <motion.div
                    key={word}
                    initial={{ opacity: 0, x: 16, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0, x: -16, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.2, 1, 0.4, 1] }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: LINE, overflow: "hidden" }}
                  >
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.04em", color: "#F5EFE2" }}>{word}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: pts >= 8 ? "#FF5B45" : "#CFE94B" }}>+{pts}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 6, borderTop: LINE2 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77" }}>TOTAL</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#CFE94B" }}>{myScore}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
