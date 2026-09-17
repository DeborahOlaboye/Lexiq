"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useReadContract, useGasPrice } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { keccak256, encodePacked } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ROUND, ROUND_FINISHED } from "@/lib/contracts";
import { scoreWord, MIN_WORD_LENGTH } from "@/lib/scoring";
import { celoFee, isMiniPay } from "@/lib/minipay";
import { selfSubmitRound } from "@/lib/selfPlay";
import { useFeeCurrency } from "@/hooks/useFeeCurrency";
import { wagmiConfig } from "@/lib/wagmi";
import { isValidWord, isValidWordSync, validateWords, setBoardWords, clearBoardWords } from "@/lib/dictionary";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUsername, displayName, getSelectedSkin, SKINS, awardBadge, getRankTitle } from "@/lib/player";
import type { Lang } from "@/lib/guestLetters";
import { getAttributionTag } from "@/lib/attribution";
import { submitScore } from "@/hooks/usePlayerStreak";
import { getPlayToken, getVersusMode, saveRoundWords, getRoundWords, clearRoundWords } from "@/lib/playSession";
import MissedWord from "./MissedWord";
import ShareCard from "./ShareCard";
import { usePlayerPoints } from "@/hooks/usePlayerPoints";
import { usePlayerStreak } from "@/hooks/usePlayerStreak";
import { hasBoardWords } from "@/lib/dictionary";

/** Seconds per difficulty, mirroring roundDuration() in Lexiq.sol. The timer used to be
 *  hardcoded to 90s, so picking Easy or Hard changed nothing on the clock. */
const DURATION: Record<number, number> = { 0: 120, 1: 90, 2: 60 };

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

/** What the opponent agent scored on the same board, as returned by the settle routes. */
type AgentPlay = { words: string[]; score: number; coverage: number; level: number; name: string };
type Settled = { score: number; rejected: number; agent?: AgentPlay };

type WordEntry = { word: string; salt: `0x${string}`; pts: number };
type Pop = { id: number; text: string };

export default function GameBoard({
  roundId,
  lang = "en",
  onBack,
  onLeaderboard,
}: {
  roundId: bigint | null;
  lang?: Lang;
  onBack: () => void;
  onLeaderboard: () => void;
}) {
  const { address } = useAccount();
  const points = usePlayerPoints();
  const { streak } = usePlayerStreak(address);
  const { data: gasPrice } = useGasPrice({ chainId: 42220 });
  // Same stablecoin the lobby charged the round against.
  const fee = useFeeCurrency(address, gasPrice);
  const contract = LEXIQ_ADDRESS;
  const [showShareCard, setShowShareCard] = useState(false);
  // The score the server signed, kept so the result never depends on this RPC node having
  // caught up with the settling transaction. `rejected` explains a low score rather than
  // leaving a player staring at a number that does not match what they played, and `agent`
  // carries what the opponent scored on the same board.
  const [settledResult, setSettledResult] = useState<Settled | null>(null);
  const [serverLetters, setServerLetters] = useState<string | null>(null);
  // Read once on mount rather than during render, so the server and first client render agree.
  const [versus, setVersus] = useState(false);
  useEffect(() => { setVersus(getVersusMode()); }, [roundId]);
  /** The agent's target for this board, known from the seed before the player starts. */
  const [agentTarget, setAgentTarget] = useState<{ score: number; name: string } | null>(null);
  const [input, setInput] = useState("");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [phase, setPhase] = useState<"active" | "done">("active");
  const [pops, setPops] = useState<Pop[]>([]);
  const [popId, setPopId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missedWords, setMissedWords] = useState<{ word: string; pts: number }[]>([]);
  /**
   * Why the current input cannot be played, so the reason is on screen rather than inferred.
   *
   * "unusable" and "dupe" used to collapse into "unchecked", which rendered nothing at all:
   * a player typing a real word out of letters the board does not have saw no message and a
   * dead Submit button, with no way to tell which of the two was wrong. A player reported
   * exactly that.
   */
  const [wordValid, setWordValid] = useState<"valid" | "invalid" | "unusable" | "dupe" | "unchecked">("unchecked");
  const [flashCombo, setFlashCombo] = useState(0);
  const comboRef = useRef(0);
  const lastWordAt = useRef(0);
  /**
   * Whether this round has already been sent.
   *
   * The auto-submit guard used to read the round's state from chain, which lags by seconds —
   * so submitting by hand a moment before the buzzer settled the round, then the buzzer fired
   * auto-submit against data that still said ACTIVE, and the server answered "Round already
   * finished" over a result that had saved perfectly well. A ref, because a manual submit
   * resolving and the buzzer can land in the same tick, where state has not propagated yet.
   */
  const submittedRef = useRef(false);
  const skin = useRef(typeof window !== "undefined" ? getSelectedSkin() : SKINS[0]).current;

  const { data: round, refetch } = useReadContract({
    address: contract, abi: LEXIQ_ABI, functionName: "getRound",
    args: roundId !== null ? [roundId] : undefined,
    // Poll hard until the round actually shows up, then settle down. A node that has not
    // caught up yet answers with a zeroed struct rather than reverting, and waiting a full
    // five seconds to notice is what made the board flash before it settled.
    query: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      refetchInterval: (q: any) => {
        const d = q?.state?.data as readonly unknown[] | undefined;
        return d && Number(d[ROUND.startedAt]) > 0 ? 5000 : 1000;
      },
    },
  });
  const state_ = round ? Number((round as readonly unknown[])[ROUND.state]) : -1;

  /**
   * Whether the chain has actually served us this round yet.
   *
   * getRound on a round the RPC node has not seen returns every field zeroed instead of
   * reverting, so startedAt reads 0 and the timer works out as long expired. Without this
   * guard the first thing a MiniPay player saw after paying for a round was "Time up",
   * until the next poll corrected it. The relayed path never hit this: the server already
   * retries until the round is visible before the board is ever mounted.
   */
  const startedAt = round ? Number((round as readonly unknown[])[ROUND.startedAt]) : 0;
  const roundReady = startedAt > 0;

  // Waiting on a node to catch up takes a second or two; waiting forever means the round
  // genuinely is not there. Bound it so a bad id offers a way out instead of spinning.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    if (roundReady) { setLoadTimedOut(false); return; }
    const t = setTimeout(() => setLoadTimedOut(true), 20000);
    return () => clearTimeout(t);
  }, [roundReady, roundId]);

  const { data: letters } = useReadContract({
    address: contract, abi: LEXIQ_ABI, functionName: "getLetters",
    args: roundId !== null ? [roundId] : undefined,
    // Gated on the round being visible for the same reason: getLetters on an unknown round
    // hands back plausible-looking letters, and this read has no refetch to correct them.
    query: { enabled: roundId !== null && roundReady },
  });
  const { data: myHigh } = useReadContract({
    address: contract, abi: LEXIQ_ABI, functionName: "highScore",
    args: address ? [address] : undefined,
  });

  // Server first. The chain read is a fallback and only trusted once the round is visible,
  // because getLetters on a round a node has not caught up to returns letters that look real.
  const chainLetters = roundReady && letters
    ? (letters as readonly `0x${string}`[])
        .map((b) => String.fromCharCode(parseInt(b.slice(2), 16)))
        .join("")
    : "";
  const letterStr = serverLetters ?? chainLetters;

  // Reset all transient state when a new round begins
  useEffect(() => {
    setPhase("active");
    setTimeLeft(90);
    setSettledResult(null);
    setServerLetters(null);
    setAgentTarget(null);
    submittedRef.current = false;
    // Restores the words if this is the same round coming back — after a refresh, a route
    // change, or the phone reclaiming a backgrounded tab. A genuinely new round has nothing
    // stored and this is still an empty list.
    setWords(roundId !== null ? getRoundWords(roundId.toString()) : []);
    setInput("");
    setSubmitting(false);
    setSubmitProgress(null);
    setSubmitError(null);
    setPops([]);
    setWordValid("unchecked");
    comboRef.current = 0;
    lastWordAt.current = 0;
    setFlashCombo(0);
  }, [roundId]);

  // Debounced async dictionary check whenever input changes
  useEffect(() => {
    const w = input.trim().toUpperCase();
    if (w.length < MIN_WORD_LENGTH) { setWordValid("unchecked"); return; }
    if (!canBuild(w, letterStr)) { setWordValid("unusable"); return; }
    if (words.some((x) => x.word === w)) { setWordValid("dupe"); return; }
    // Local when the board's hashes are loaded, which is the normal case — no debounce, no
    // round trip, so the tick appears as the player finishes typing rather than a second later.
    const local = isValidWordSync(w);
    if (local !== null) { setWordValid(local ? "valid" : "invalid"); return; }
    setWordValid("unchecked");
    const t = setTimeout(async () => {
      const ok = await isValidWord(w, lang);
      setWordValid(ok ? "valid" : "invalid");
    }, 250);
    return () => clearTimeout(t);
  }, [input, letterStr, words, lang]);

  // A reload loses the set the lobby loaded, so fetch it rather than fall back to a request
  // per word.
  useEffect(() => {
    if (roundId === null) return;
    let cancelled = false;
    fetch("/api/round/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId: roundId.toString(), playToken: getPlayToken() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (d.wordHashes && !hasBoardWords()) setBoardWords(d.wordHashes);
        // The authoritative letters. The server resolves these with a retry until the round
        // is actually visible, which the browser's own read cannot do.
        if (d.letters) setServerLetters(d.letters);
        if (d.agent) setAgentTarget(d.agent);
      })
      .catch(() => { /* falls back to server validation */ });
    return () => { cancelled = true; };
  }, [roundId]);

  useEffect(() => {
    if (!round) return;
    if (Number((round as readonly unknown[])[ROUND.state]) === ROUND_FINISHED) setPhase("done");
  }, [round]);

  useEffect(() => {
    if (phase !== "active" || !roundReady) return;
    const r = round as readonly unknown[];
    const end = startedAt + DURATION[Number(r[ROUND.difficulty])];
    const tick = () => setTimeLeft(Math.max(0, end - Math.floor(Date.now() / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, round, roundReady, startedAt]);

  /**
   * One relayed call. The server re-checks every word against the dictionary and the round's
   * letters, scores it, and signs the result for the contract — so this sends words, not a
   * score, and the player signs nothing and pays nothing.
   */
  // What was on the board, once the round is over. Seeing what you missed — and being able to
  // tap it for a meaning — is the vocabulary loop, and it only ever existed in guest mode.
  useEffect(() => {
    if (state_ !== ROUND_FINISHED || !letterStr) return;
    const found = new Set(words.map((w) => w.word));
    fetch(`/api/words?letters=${letterStr}&lang=${lang}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.words) setMissedWords(d.words.filter((w: { word: string }) => !found.has(w.word)).slice(0, 12));
      })
      .catch(() => {});
  }, [state_, letterStr, lang]); // eslint-disable-line

  async function doSubmit() {
    if (!roundId || submitting || submittedRef.current || words.length === 0) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      setSubmitProgress("Scoring your words…");
      const username = address ? getStoredUsername() ?? displayName(address) : "Anonymous";
      const wordList = words.map((w) => w.word);

      // MiniPay players settle their own round and pay the fee in the stablecoin they hold.
      // Guests and signed-in players are relayed — neither has a funded wallet to pay from.
      let score: number;
      if (isMiniPay() && address) {
        setSubmitProgress("Confirm in MiniPay…");
        const settled = await selfSubmitRound({
          roundId, words: wordList, username, feeCurrency: fee.address,
        });
        score = settled.score;
        setSettledResult({ score, rejected: wordList.length - settled.wordCount, agent: settled.agent });
      } else {
        const res = await fetch("/api/round/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundId: roundId.toString(), words: wordList, playToken: getPlayToken(), username }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not submit round");
        score = data.score;
        setSettledResult({ score, rejected: data.rejected ?? 0, agent: data.agent });
      }

      setSubmitProgress(null);
      if (address) submitScore({ playerId: address, username, score });
      setTimeout(() => refetch(), 1000);
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      // "Round already finished" is not a failure: the round settled, and this is a second
      // attempt at it. Reporting it as an error tells a player their score was lost at the
      // exact moment it was safely saved, which is the worst thing to be wrong about.
      if (/already finished/i.test(msg)) {
        setSubmitProgress(null);
        refetch();
        return;
      }
      // Anything else may well work on a second try, so let them have one.
      submittedRef.current = false;
      setSubmitError(msg && msg.length < 120 ? msg : "Could not submit — tap to retry.");
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
  // Never "time up" on a round we have not actually loaded yet.
  const timeUp = roundReady && (timeLeft === 0 || phase === "done");

  // Once the buzzer goes there is nothing left to decide, so relayed players never have to tap
  // anything — the round settles itself. That tap was a way to lose a finished round simply by
  // hesitating over it. MiniPay keeps the button, because settling there opens a wallet
  // confirmation and that should not appear unasked.
  useEffect(() => {
    if (timeUp && !submitting && !submitError && !submittedRef.current && words.length > 0
        && state_ !== ROUND_FINISHED && !isMiniPay()) {
      doSubmit();
    }
  }, [timeUp]); // eslint-disable-line

  useEffect(() => {
    if (roundId === null) return;
    if (state_ === ROUND_FINISHED || settledResult) { clearRoundWords(roundId.toString()); return; }
    saveRoundWords(roundId.toString(), words);
  }, [roundId, words, state_, settledResult]);

  const submitWord = useCallback(() => {
    if (!isActive || !roundId) return;
    const word = input.trim().toUpperCase();
    if (word.length < MIN_WORD_LENGTH || !canBuild(word, letterStr) || words.find((w) => w.word === word) || wordValid !== "valid") return;
    const salt = randomSalt();
    const pts = scoreWord(word);
    // Badges are awarded where the thing actually happens. They were advertised on the
    // leaderboard and the landing page while awardBadge() had no call sites at all, so no
    // player could ever earn one.
    if (word.length === 7) awardBadge("jackpot");
    setWords((prev) => [...prev, { word, salt, pts }]);
    setInput("");
    const id = popId + 1;
    setPopId(id);
    setPops((p) => [...p, { id, text: "+" + pts }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 950);
    // Combo tracking
    const now = Date.now();
    const newCombo = lastWordAt.current > 0 && (now - lastWordAt.current) < 4500 ? comboRef.current + 1 : 1;
    comboRef.current = newCombo;
    if (newCombo >= 3) awardBadge("onfire");
    lastWordAt.current = now;
    if (newCombo >= 2) {
      setFlashCombo(newCombo);
      setTimeout(() => setFlashCombo(0), 1400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, roundId, input, words, letterStr, popId, wordValid]);

  function tapTile(l: string) {
    if (!isActive) return;
    const avail = getLetterCounts(letterStr);
    const used = getLetterCounts(input);
    if ((used[l] || 0) < (avail[l] || 0)) setInput((prev) => prev + l);
  }


  if (!roundId) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <p style={{ fontSize: 14, color: "#9A8C77" }}>No active round.</p>
      <button onClick={onBack} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "#CFE94B", background: "none", border: "none", cursor: "pointer" }}>← Back to lobby</button>
    </div>
  );
  // roundReady, not just `round`: a zeroed struct from a node that has not caught up is
  // truthy, and rendering the board against it is what produced the flash of "Time up".
  // Also waits on letters: rendering a playable board before they are known is what let a
  // player spend a whole round building words against letters that were never theirs.
  if (!roundReady || !letterStr) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <p style={{ fontSize: 14, color: "#9A8C77", fontFamily: "var(--font-mono)" }}>
        {loadTimedOut ? "Could not load that round." : "Loading round…"}
      </p>
      {loadTimedOut && (
        <button onClick={onBack} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "#CFE94B", background: "none", border: "none", cursor: "pointer" }}>
          ← Back to lobby
        </button>
      )}
    </div>
  );

  const r          = round as readonly unknown[];
  // Prefer what the server signed over the chain read: the settling transaction may not be
  // visible to this node yet, and showing 0 for a round that scored is worse than showing the
  // authoritative number a moment early.
  const finalScore = settledResult?.score ?? Number(r[ROUND.score]);
  const state      = Number(r[ROUND.state]);
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
              {/* A round that scored nothing needs a reason. Silently showing 0 after a player
                  watched their own words being accepted is the worst possible answer. */}
              {!!settledResult?.rejected && (
                <div style={{ fontSize: 13, color: "#FF5B45", marginTop: 10, maxWidth: 320, lineHeight: 1.5 }}>
                  {settledResult.rejected} {settledResult.rejected === 1 ? "word" : "words"} did not count against this board&apos;s letters.
                  {settledResult.score === 0 && " If the letters you saw look wrong, reload and start a new round."}
                </div>
              )}

              {/* Head to head. The agent played these same seven letters, and its words were
                  settled by the round's seed before this player typed anything — so this is a
                  race that was already run, not a score invented to beat theirs. */}
              {versus && settledResult?.agent && (
                <div style={{ width: "100%", marginTop: 18, background: "#241C13", border: LINE, borderRadius: 16, padding: "14px 16px" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 10 }}>
                    Head to head
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", marginBottom: 3 }}>You</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: finalScore >= settledResult.agent.score ? "#CFE94B" : "#F5EFE2" }}>
                        {finalScore}
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: "#6E6557" }}>vs</div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", marginBottom: 3 }}>{settledResult.agent.name}</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: settledResult.agent.score > finalScore ? "#FF5B45" : "#F5EFE2" }}>
                        {settledResult.agent.score}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "center", marginTop: 10, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14,
                    color: finalScore > settledResult.agent.score ? "#CFE94B" : finalScore === settledResult.agent.score ? "#CBC0AE" : "#FF5B45" }}>
                    {finalScore > settledResult.agent.score
                      ? `You win by ${finalScore - settledResult.agent.score}`
                      : finalScore === settledResult.agent.score
                        ? "Dead heat"
                        : `${settledResult.agent.name} wins by ${settledResult.agent.score - finalScore}`}
                  </div>
                  {settledResult.agent.words.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                      {settledResult.agent.words.map((w) => {
                        const mine = words.some((x) => x.word === w);
                        return (
                          <span key={w} title={mine ? "You found this too" : "You missed this one"}
                            style={{ padding: "4px 9px", borderRadius: 8, background: mine ? "rgba(207,233,75,.10)" : "#1E1710", border: LINE,
                              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.04em",
                              color: mine ? "#CFE94B" : "#9A8C77" }}>
                            {w}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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
            {sortedWords.length > 0 && (
              <div style={{ width: "100%", marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {sortedWords.map(({ word, pts }) => (
                  <span key={word} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 10, background: "#241C13", border: LINE, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", color: "#F5EFE2" }}>
                    {word} <b style={{ color: pts >= 8 ? "#FF5B45" : "#CFE94B" }}>+{pts}</b>
                  </span>
                ))}
              </div>
            )}
            {missedWords.length > 0 && (
              <div style={{ width: "100%", marginTop: 14, background: "#241C13", border: LINE, borderRadius: 14, padding: 14, textAlign: "left" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 9 }}>
                  Words you missed · tap one for its meaning
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {missedWords.map(({ word, pts }) => (
                    <MissedWord key={word} word={word} pts={pts} lang={lang} />
                  ))}
                </div>
              </div>
            )}
            <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }} onClick={onBack} style={{ width: "100%", marginTop: 20, padding: "clamp(13px,2.5vw,16px)", borderRadius: 15, background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2vw,17px)", boxShadow: "0 6px 0 #A9C931", border: "none", cursor: "pointer" }}>Play again</motion.button>
            <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 10 }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowShareCard(true)} style={{ flex: 1, padding: "clamp(11px,2vw,13px)", borderRadius: 14, background: "none", border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Share result</motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onLeaderboard} style={{ flex: 1, padding: "clamp(11px,2vw,13px)", borderRadius: 14, background: "none", border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Leaderboard</motion.button>
            </div>

            {/* The same card guests get. Signed-in players are the ones who are ranked and
                prize-eligible, so their share is the one worth making shareable — the old
                button sent plain text with no link in it at all. */}
            <AnimatePresence>
              {showShareCard && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setShowShareCard(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                  <motion.div
                    initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: "min(360px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "#2F2517", border: LINE2, borderRadius: 22, padding: 26, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "#F5EFE2" }}>Share your score</span>
                      <button onClick={() => setShowShareCard(false)}
                        style={{ fontSize: 13, color: "#6E6557", cursor: "pointer", background: "none", border: "none", padding: "4px 8px" }}>
                        ✕ Close
                      </button>
                    </div>
                    <ShareCard
                      score={finalScore}
                      words={words.length}
                      bestWord={sortedWords[0]?.word ?? null}
                      bestPts={sortedWords[0]?.pts ?? 0}
                      username={getStoredUsername() ?? (address ? displayName(address) : "Anonymous")}
                      rank={getRankTitle(points)}
                      streak={streak}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── ACTIVE RACE ── */
  return (
    <div style={{ paddingTop: "clamp(8px,2vw,16px)", position: "relative" }}>
      {/* Combo flash */}
      <AnimatePresence>
        {flashCombo >= 2 && (
          <motion.div
            key={flashCombo + "-" + lastWordAt.current}
            initial={{ opacity: 0, scale: 0.55, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -24 }}
            transition={{ duration: 0.3, ease: [0.2, 1.5, 0.4, 1] as [number,number,number,number] }}
            style={{ position: "absolute", top: "clamp(50px,12vw,80px)", left: "50%", transform: "translateX(-50%)", zIndex: 50, pointerEvents: "none", textAlign: "center", whiteSpace: "nowrap" }}>
            <motion.div
              animate={{ textShadow: ["0 0 16px rgba(255,91,69,.6)", "0 0 40px rgba(255,91,69,.9)", "0 0 16px rgba(255,91,69,.6)"] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px,6vw,38px)", color: "#FF5B45", letterSpacing: "0.05em" }}>
              ×{flashCombo} ON FIRE 🔥
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77", background: "none", border: "none", cursor: "pointer", padding: 0 }}>‹ Back</button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557" }}>Round #{roundId.toString()}</span>
      </div>

        {/* The target, while there is still time to do something about it. The agent's words
            were fixed when the round opened, so showing the number now gives nothing away —
            and a race you can see is the difference between an opponent and a verdict. */}
        {versus && agentTarget && phase === "active" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, padding: "9px 13px", borderRadius: 12, background: myScore > agentTarget.score ? "rgba(207,233,75,.10)" : "rgba(255,91,69,.08)", border: myScore > agentTarget.score ? "1px solid rgba(207,233,75,.35)" : "1px solid rgba(255,91,69,.3)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#CBC0AE" }}>
              ⚔ <b style={{ color: "#F5EFE2" }}>{agentTarget.name}</b> scored {agentTarget.score} here
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: myScore > agentTarget.score ? "#CFE94B" : "#FF5B45" }}>
              {myScore > agentTarget.score
                ? `Ahead by ${myScore - agentTarget.score}`
                : `${agentTarget.score - myScore + 1} more to beat it`}
            </span>
          </div>
        )}

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
                      style={{ width: "clamp(38px,8vw,46px)", height: "clamp(44px,9vw,54px)", borderRadius: 9, background: skin.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,5vw,27px)", color: skin.ink, cursor: disabled ? "default" : "pointer", boxShadow: disabled ? `inset 0 -3px 0 ${skin.edge}` : `inset 0 -3px 0 ${skin.edge}, 0 4px 10px rgba(0,0,0,.3)` }}
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
                {input.length >= MIN_WORD_LENGTH && wordValid !== "unchecked" && (
                  <motion.div
                    key={wordValid}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 6, paddingLeft: 4, color: wordValid === "valid" ? "#CFE94B" : "#FF5B45" }}
                  >
                    {wordValid === "valid" ? "✓ Valid word"
                      : wordValid === "unusable" ? "✗ Uses letters this board does not have"
                      : wordValid === "dupe" ? "✗ You already played that one"
                      : "✗ Not in dictionary"}
                  </motion.div>
                )}
              </AnimatePresence>
              {(() => {
                const submitDisabled = input.length < MIN_WORD_LENGTH || !canBuild(input, letterStr) || !!words.find((w) => w.word === input) || wordValid !== "valid";
                return (
                  <motion.button
                    onClick={submitWord}
                    disabled={submitDisabled}
                    animate={!submitDisabled ? { boxShadow: ["0 5px 0 #A9C931", "0 5px 22px rgba(207,233,75,0.55)", "0 5px 0 #A9C931"] } : { boxShadow: "none" }}
                    transition={!submitDisabled ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                    whileHover={!submitDisabled ? { scale: 1.02, y: -2 } : undefined}
                    whileTap={!submitDisabled ? { scale: 0.97 } : undefined}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "clamp(12px,2.5vw,14px)", borderRadius: 14, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2.5vw,17px)", cursor: submitDisabled ? "default" : "pointer", opacity: submitDisabled ? 0.4 : 1 }}>
                    {wordValid === "unusable"
                      ? "Letters not on the board"
                      : wordValid === "dupe"
                      ? "Already played"
                      : wordValid === "invalid"
                      ? "Not a word"
                      : input.length >= MIN_WORD_LENGTH && canBuild(input, letterStr) && scoreWord(input) > 0
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
