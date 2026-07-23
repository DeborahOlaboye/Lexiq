"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isValidWord } from "@/lib/dictionary";
import { scoreWord } from "@/lib/contracts";
import { generateGuestLetters, type Lang } from "@/lib/guestLetters";
import { getGuestId, getStoredUsername, displayName, getSelectedSkin, SKINS, recordPlay, getRankTitle, getLevel, getXP } from "@/lib/player";
import { submitScore } from "@/hooks/usePlayerStreak";
import ShareCard from "./ShareCard";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

const CONFETTI = [
  { left: "12%", dur: "2.4s", delay: "0s",    color: "#CFE94B", round: false },
  { left: "30%", dur: "2.9s", delay: "0.3s",  color: "#FF5B45", round: true  },
  { left: "48%", dur: "2.6s", delay: "0.6s",  color: "#F5EFE2", round: false },
  { left: "66%", dur: "3.1s", delay: "0.15s", color: "#CFE94B", round: true  },
  { left: "82%", dur: "2.7s", delay: "0.5s",  color: "#FF5B45", round: false },
];

const DURATIONS: Record<number, number> = { 0: 120, 1: 90, 2: 60 };
const DIFF_LABEL: Record<number, string>  = { 0: "Easy", 1: "Normal", 2: "Hard" };

type WordEntry = { word: string; pts: number };
type Pop = { id: number; text: string };

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

const LANG_LABEL: Record<Lang, string> = { en: "🇬🇧 EN", es: "🇪🇸 ES", fr: "🇫🇷 FR" };

export default function GuestBoard({
  difficulty = 1,
  lang = "en",
  onBack,
  onLeaderboard,
}: {
  difficulty?: 0 | 1 | 2;
  lang?: Lang;
  onBack: () => void;
  onLeaderboard?: () => void;
}) {
  const letterStr   = useRef(generateGuestLetters(lang)).current;
  const guestId     = useRef(typeof window !== "undefined" ? getGuestId() : "").current;
  const duration    = DURATIONS[difficulty] ?? 90;

  const [input, setInput]           = useState("");
  const [words, setWords]           = useState<WordEntry[]>([]);
  const [timeLeft, setTimeLeft]     = useState(duration);
  const [phase, setPhase]           = useState<"idle" | "active" | "done">("active");
  const [showResults, setShowResults] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [pops, setPops]             = useState<Pop[]>([]);
  const [popId, setPopId]           = useState(0);
  const [wordValid, setWordValid]   = useState<"valid" | "invalid" | "unchecked">("unchecked");
  const [submitted, setSubmitted]   = useState(false);
  const [flashCombo, setFlashCombo] = useState(0);
  const [missedWords, setMissedWords] = useState<WordEntry[]>([]);
  const [streak, setStreak]         = useState(0);
  const [copied, setCopied]         = useState(false);
  const [bestScore, setBestScore]   = useState<number>(0);
  const comboRef    = useRef(0);
  const lastWordAt  = useRef(0);
  const skin        = useRef(typeof window !== "undefined" ? getSelectedSkin() : SKINS[0]).current;

  // Fetch personal best
  useEffect(() => {
    if (!guestId) return;
    fetch("/api/scores")
      .then(r => r.json())
      .then(({ scores }: { scores: { playerId: string; score: number }[] }) => {
        const me = scores.find(s => s.playerId === guestId);
        if (me) setBestScore(me.score);
      })
      .catch(() => {});
  }, [guestId]);

  // Countdown — only when active
  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(id); setPhase("done"); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Submit score + record streak when game ends
  useEffect(() => {
    if (phase !== "done" || submitted || !guestId) return;
    const myScore = words.reduce((s, w) => s + w.pts, 0);
    setSubmitted(true);
    submitScore({ playerId: guestId, username: getStoredUsername() ?? displayName(), score: myScore });
    const { count } = recordPlay();
    setStreak(count);
  }, [phase]); // eslint-disable-line

  // Fetch all valid words when done
  useEffect(() => {
    if (phase !== "done") return;
    const found = new Set(words.map(w => w.word));
    fetch(`/api/words?letters=${letterStr}&lang=${lang}`)
      .then(r => r.json())
      .then(({ words: all }: { words: WordEntry[] }) => {
        setMissedWords(all.filter(w => !found.has(w.word)).slice(0, 15));
      })
      .catch(() => {});
  }, [phase]); // eslint-disable-line

  // Debounced dictionary check
  useEffect(() => {
    const w = input.trim().toUpperCase();
    if (w.length < 2 || !canBuild(w, letterStr)) { setWordValid("unchecked"); return; }
    setWordValid("unchecked");
    const t = setTimeout(async () => {
      const ok = await isValidWord(w, lang);
      setWordValid(ok ? "valid" : "invalid");
    }, 250);
    return () => clearTimeout(t);
  }, [input, letterStr]);

  const myScore     = words.reduce((s, w) => s + w.pts, 0);
  const usedCounts  = getLetterCounts(input);
  const availCounts = getLetterCounts(letterStr);
  const timeStr     = String(Math.floor(timeLeft / 60)).padStart(2, "0") + ":" + String(timeLeft % 60).padStart(2, "0");
  const timerColor  = timeLeft > 30 ? "#F5EFE2" : timeLeft > 10 ? "#F4C84B" : "#FF5B45";
  const isActive    = phase === "active" && timeLeft > 0;
  const sortedWords = [...words].sort((a, b) => b.pts - a.pts);
  const topWord     = sortedWords[0];
  const beatBest    = myScore > bestScore && bestScore > 0;
  const progressPct = bestScore > 0 ? Math.min(100, Math.round((myScore / bestScore) * 100)) : 0;
  const rankTitle   = typeof window !== "undefined" ? getRankTitle(getLevel(getXP())) : "Rookie";

  const submitWord = useCallback(() => {
    if (!isActive) return;
    const word = input.trim().toUpperCase();
    if (word.length < 2 || !canBuild(word, letterStr) || words.find(w => w.word === word) || wordValid !== "valid") return;
    const pts = scoreWord(word);
    setWords(prev => [...prev, { word, pts }]);
    setInput("");
    const id = popId + 1;
    setPopId(id);
    setPops(p => [...p, { id, text: "+" + pts }]);
    setTimeout(() => setPops(p => p.filter(x => x.id !== id)), 950);
    const now = Date.now();
    const newCombo = lastWordAt.current > 0 && (now - lastWordAt.current) < 4500 ? comboRef.current + 1 : 1;
    comboRef.current = newCombo;
    lastWordAt.current = now;
    if (newCombo >= 2) {
      setFlashCombo(newCombo);
      setTimeout(() => setFlashCombo(0), 1400);
    }
  }, [isActive, input, words, letterStr, popId, wordValid]);

  function tapTile(l: string) {
    if (!isActive) return;
    const avail = getLetterCounts(letterStr);
    const used  = getLetterCounts(input);
    if ((used[l] || 0) < (avail[l] || 0)) setInput(prev => prev + l);
  }

  function shareText() {
    return `I scored ${myScore} pts on Lexiq${topWord ? ` — best word: ${topWord.word} (+${topWord.pts})` : ""}${streak > 1 ? ` · Day ${streak} streak 🔥` : ""}.\nCan you beat it? https://lexiq-rust.vercel.app`;
  }

  async function doNativeShare() {
    const text = shareText();
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      await doCopy();
    }
  }

  async function doCopy() {
    await navigator.clipboard.writeText(shareText()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function shareX() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}`, "_blank");
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, "_blank");
  }

  /* ── RESULTS SCREEN ── */
  if (showResults) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 1, 0.4, 1] as [number, number, number, number] }}
        style={{ position: "relative", width: "min(560px, 100%)", margin: "0 auto", paddingTop: "clamp(12px,3vw,24px)", overflow: "visible" }}>

        {/* Confetti */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {CONFETTI.map((c, i) => (
            <span key={i} className="absolute top-0 confetti-piece"
              style={{ left: c.left, width: 9, height: 9, "--dur": c.dur, "--delay": c.delay, background: c.color, borderRadius: c.round ? "50%" : "2px" } as React.CSSProperties} />
          ))}
        </div>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>

          {/* Badge */}
          {beatBest ? (
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }}
              transition={{ duration: 0.35, ease: [0.2, 1.5, 0.4, 1] as [number, number, number, number] }}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 15px", borderRadius: 100, background: "#FF5B45", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, letterSpacing: "0.1em", boxShadow: "0 6px 18px rgba(255,91,69,.45)" }}>
              ★ NEW BEST!
            </motion.div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 15px", borderRadius: 100, background: "#241C13", border: LINE, color: "#CBC0AE", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em" }}>
              ROUND COMPLETE
            </div>
          )}

          {/* Big score */}
          <motion.div key={myScore} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
            transition={{ duration: 0.4, ease: [0.2, 1.5, 0.4, 1] as [number, number, number, number] }}
            style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(64px,16vw,88px)", color: "#CFE94B", lineHeight: 0.95, marginTop: 18 }}>
            {myScore}
          </motion.div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#F5EFE2", marginTop: 2 }}>points</div>
          {bestScore > 0 && (
            <div style={{ fontSize: 14, color: "#9A8C77", marginTop: 8 }}>
              {beatBest ? `▲ +${myScore - bestScore} above your best!` : `Best: ${bestScore} pts`}
            </div>
          )}

          {/* Words + Best word */}
          <div style={{ display: "flex", gap: 10, marginTop: 22, width: "100%" }}>
            <div style={{ flex: 1, background: "#241C13", border: LINE, borderRadius: 14, padding: 14 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase" }}>Words</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "#F5EFE2", marginTop: 4 }}>{words.length}</div>
            </div>
            {topWord ? (
              <div style={{ flex: 1.6, background: "#241C13", border: LINE, borderRadius: 14, padding: 14, textAlign: "left" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase" }}>Best word</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, letterSpacing: "0.04em", color: "#F5EFE2" }}>{topWord.word}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#FF5B45", fontSize: 16 }}>+{topWord.pts}</span>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1.6, background: "#241C13", border: LINE, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557" }}>No words found</span>
              </div>
            )}
          </div>

          {/* Words found list */}
          {sortedWords.length > 0 && (
            <div style={{ width: "100%", marginTop: 11, background: "#241C13", border: LINE, borderRadius: 14, padding: 14, textAlign: "left" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 9 }}>Words found</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {sortedWords.map(({ word, pts }) => (
                  <span key={word} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, background: "rgba(255,255,255,.04)", border: LINE, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#F5EFE2" }}>
                    {word} <b style={{ color: pts >= 8 ? "#FF5B45" : "#CFE94B" }}>+{pts}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Words you missed */}
          {missedWords.length > 0 && (
            <div style={{ width: "100%", marginTop: 11, background: "#241C13", border: LINE, borderRadius: 14, padding: 14, textAlign: "left" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 9 }}>
                Words you missed
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {missedWords.map(({ word, pts }) => (
                  <span key={word} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "#6E6557" }}>
                    {word} <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: 11 }}>+{pts}</span>
                  </span>
                ))}
              </div>
              {missedWords.some(w => w.pts >= 11) && (
                <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,91,69,.75)" }}>
                  ↑ jackpot word in there. go again?
                </div>
              )}
            </div>
          )}

          {/* Streak chip */}
          {streak > 0 && (
            <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 100, background: "rgba(255,91,69,.12)", border: "1px solid rgba(255,91,69,.35)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#FF5B45" }}>
              🔥 DAY {streak} {streak > 1 ? "▲" : "· keep it going tomorrow"}
            </div>
          )}

          {/* Actions */}
          <div style={{ width: "100%", marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}>
            <motion.button onClick={onBack}
              animate={{ boxShadow: ["0 6px 0 #A9C931", "0 6px 24px rgba(207,233,75,0.5)", "0 6px 0 #A9C931"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 15, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, boxShadow: "0 6px 0 #A9C931", cursor: "pointer" }}>
              Play again
            </motion.button>
            <button onClick={() => setShowShareCard(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, borderRadius: 14, border: LINE2, background: "transparent", color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              ↗ Share result
            </button>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={onBack}
                style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 14, border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer", background: "transparent" }}>
                Lobby
              </button>
              {onLeaderboard && (
                <button onClick={onLeaderboard}
                  style={{ flex: 1, textAlign: "center", padding: 13, borderRadius: 14, border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer", background: "transparent" }}>
                  Leaderboard
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Share card modal */}
        <AnimatePresence>
          {showShareCard && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowShareCard(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(13,10,7,.82)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.2, 1.5, 0.4, 1] as [number, number, number, number] }}
                onClick={e => e.stopPropagation()}
                style={{ width: "min(360px, 100%)", background: "#2F2517", border: LINE2, borderRadius: 22, padding: 26, textAlign: "center" }}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "#F5EFE2" }}>Share your score</span>
                  <button onClick={() => setShowShareCard(false)}
                    style={{ fontSize: 13, color: "#6E6557", cursor: "pointer", background: "none", border: "none", padding: "4px 8px" }}>
                    ✕ Close
                  </button>
                </div>
                <ShareCard
                  score={myScore}
                  words={words.length}
                  bestWord={topWord?.word ?? null}
                  bestPts={topWord?.pts ?? 0}
                  username={getStoredUsername() ?? "Anonymous"}
                  rank={rankTitle}
                  streak={streak}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  /* ── GAME BOARD (idle / active / done-overlay) ── */
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
            transition={{ duration: 0.3, ease: [0.2, 1.5, 0.4, 1] as [number, number, number, number] }}
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <motion.button onClick={onBack} whileHover={{ opacity: 0.7 }}
          style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#9A8C77", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          ‹ Lobby
        </motion.button>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77", padding: "3px 9px", borderRadius: 7, border: LINE, background: "#241C13" }}>
            {DIFF_LABEL[difficulty]}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77", padding: "3px 9px", borderRadius: 7, border: LINE, background: "#241C13" }}>
            {LANG_LABEL[lang]}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", padding: "3px 9px", borderRadius: 7, border: LINE, background: "rgba(255,91,69,.07)" }}>
            Guest
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>

        {/* Board */}
        <div style={{ position: "relative", flex: "1 1 320px", minWidth: 0 }}>

          {/* Done overlay */}
          {phase === "done" && !showResults && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
              style={{ position: "absolute", inset: -2, background: "rgba(13,10,7,.92)", backdropFilter: "blur(3px)", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 30, textAlign: "center", zIndex: 10 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.18em", color: "#FF5B45" }}>TIME!</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 64, color: "#CFE94B", lineHeight: 1 }}>{myScore}</div>
              <div style={{ color: "#CBC0AE", fontSize: 14 }}>{words.length} word{words.length !== 1 ? "s" : ""} found</div>
              <motion.button
                onClick={() => setShowResults(true)}
                animate={{ boxShadow: ["0 5px 0 #A9C931", "0 5px 20px rgba(207,233,75,0.5)", "0 5px 0 #A9C931"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.97 }}
                style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 14, background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, cursor: "pointer", border: "none", boxShadow: "0 5px 0 #A9C931" }}>
                See results →
              </motion.button>
            </motion.div>
          )}

          {/* Stat strip */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {[
              {
                label: "Score",
                val: <motion.span key={myScore} initial={myScore > 0 ? { scale: 1.4 } : { scale: 1 }} animate={myScore > 0 ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={myScore > 0 ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : {}} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", color: "#CFE94B", lineHeight: 1.05, display: "inline-block" }}>{myScore}</motion.span>,
              },
              {
                label: "Words",
                val: <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", color: "#F5EFE2", lineHeight: 1.05 }}>{words.length}</span>,
              },
              {
                label: "Time",
                val: <motion.span animate={timeLeft > 0 ? { scale: timeLeft <= 10 ? [1, 1.14, 1] : [1, 1.04, 1] } : { scale: 1 }} transition={timeLeft > 0 ? { duration: timeLeft <= 10 ? 0.6 : 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }} style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "clamp(22px,4.5vw,28px)", lineHeight: 1.12, color: timerColor, display: "inline-block" }}>{timeStr}</motion.span>,
              },
            ].map(({ label, val }) => (
              <div key={label} style={{ flex: 1, background: "#241C13", borderRadius: 15, padding: "clamp(9px,2vw,12px)", textAlign: "center", border: LINE }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "#9A8C77", textTransform: "uppercase" }}>{label}</div>
                {val}
              </div>
            ))}
          </div>

          {/* Chasing best */}
          {bestScore > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", marginBottom: 5 }}>
                <span>CHASING BEST</span><span>{bestScore} pts</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: "#1E1710", border: LINE, overflow: "hidden" }}>
                <motion.div
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, #CFE94B, #FF5B45)" }} />
              </div>
            </div>
          )}

          {/* Letter tiles */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
            {letterStr.split("").map((l, i) => {
              const isUsed = (usedCounts[l] || 0) >= (availCounts[l] || 0) && (usedCounts[l] || 0) > 0;
              const disabled = isUsed || !isActive;
              return (
                <motion.div key={i}
                  animate={{ y: disabled ? 0 : [0, -6, 0] }}
                  transition={disabled ? { duration: 0.3 } : { duration: 2.2 + i * 0.28, repeat: Infinity, ease: "easeInOut", delay: i * 0.21 }}
                  style={{ display: "inline-flex" }}>
                  <motion.button onClick={() => tapTile(l)} disabled={disabled}
                    initial={{ opacity: 0, scale: 0.72, rotate: -10 }}
                    animate={{ opacity: disabled ? 0.3 : 1, scale: 1, rotate: 0 }}
                    transition={{ duration: 0.4, ease: [0.2, 1.4, 0.4, 1] as [number, number, number, number], delay: i * 0.07 }}
                    whileHover={!disabled ? { scale: 1.15 } : undefined}
                    whileTap={!disabled ? { scale: 0.84 } : undefined}
                    style={{ width: "clamp(38px,8vw,46px)", height: "clamp(44px,9vw,54px)", borderRadius: 9, background: skin.bg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,5vw,27px)", color: skin.ink, cursor: disabled ? "default" : "pointer", boxShadow: disabled ? `inset 0 -3px 0 ${skin.edge}` : `inset 0 -3px 0 ${skin.edge}, 0 4px 10px rgba(0,0,0,.3)` }}>
                    {l}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>

          {/* Input row */}
          {isActive && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input value={input}
                  onChange={e => { const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, ""); if (val === "" || canBuild(val, letterStr)) setInput(val); }}
                  onKeyDown={e => e.key === "Enter" && submitWord()}
                  placeholder="Build a word…" autoFocus
                  style={{ flex: 1, minWidth: 0, background: "#1E1710", borderRadius: 13, padding: "clamp(11px,2vw,14px) clamp(12px,2vw,16px)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(16px,3vw,18px)", letterSpacing: "0.14em", color: "#F5EFE2", textTransform: "uppercase", outline: "none", border: wordValid === "valid" ? "1px solid #CFE94B" : wordValid === "invalid" ? "1px solid rgba(255,91,69,.6)" : LINE2 }} />
                <motion.button onClick={() => setInput(p => p.slice(0, -1))}
                  animate={input.length > 0 ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.4 }}
                  transition={input.length > 0 ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : {}}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
                  style={{ width: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "#241C13", border: LINE, borderRadius: 13, fontSize: 18, color: "#CBC0AE", cursor: "pointer" }}>⌫</motion.button>
              </div>
              <AnimatePresence mode="wait">
                {input.length >= 2 && wordValid !== "unchecked" && (
                  <motion.div key={wordValid} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 6, paddingLeft: 4, color: wordValid === "valid" ? "#CFE94B" : "#FF5B45" }}>
                    {wordValid === "valid" ? "✓ Valid word" : "✗ Not in dictionary"}
                  </motion.div>
                )}
              </AnimatePresence>
              {(() => {
                const submitDisabled = input.length < 2 || !canBuild(input, letterStr) || !!words.find(w => w.word === input) || wordValid !== "valid";
                return (
                  <motion.button onClick={submitWord} disabled={submitDisabled}
                    animate={!submitDisabled ? { boxShadow: ["0 5px 0 #A9C931", "0 5px 22px rgba(207,233,75,0.55)", "0 5px 0 #A9C931"] } : { boxShadow: "none" }}
                    transition={!submitDisabled ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                    whileHover={!submitDisabled ? { scale: 1.02, y: -2 } : undefined}
                    whileTap={!submitDisabled ? { scale: 0.97 } : undefined}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "clamp(12px,2.5vw,14px)", borderRadius: 14, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2.5vw,17px)", cursor: submitDisabled ? "default" : "pointer", opacity: submitDisabled ? 0.4 : 1 }}>
                    {wordValid === "invalid" ? "Not a word" : input.length >= 2 && canBuild(input, letterStr) && scoreWord(input) > 0 ? `Submit  +${scoreWord(input)}` : "Submit"}
                  </motion.button>
                );
              })()}
              {pops.map(p => (
                <span key={p.id} className="animate-float-up absolute pointer-events-none"
                  style={{ left: "50%", top: 30, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 38, color: "#CFE94B", textShadow: "0 3px 12px rgba(0,0,0,.5)" }}>
                  {p.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Found words panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
          style={{ flex: "1 1 220px", minWidth: 0, background: "#241C13", border: LINE, borderRadius: 16, padding: "clamp(12px,3vw,18px)", alignSelf: "flex-start" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 11 }}>Found words · {words.length}</div>
          {words.length === 0 ? (
            <div style={{ color: "#6E6557", fontSize: 13, lineHeight: 1.5 }}>Words you find will stack up here. Hunt for the 7-letter bomb.</div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                <AnimatePresence initial={false}>
                  {[...words].reverse().map(({ word, pts }) => (
                    <motion.span key={word}
                      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 10, background: "#1E1710", border: LINE, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", color: "#F5EFE2" }}>
                      {word} <b style={{ color: pts >= 8 ? "#FF5B45" : "#CFE94B" }}>+{pts}</b>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: LINE }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77" }}>TOTAL</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#CFE94B" }}>{myScore}</span>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
