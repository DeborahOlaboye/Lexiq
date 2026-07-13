"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isValidWord } from "@/lib/dictionary";
import { scoreWord } from "@/lib/contracts";
import { generateGuestLetters } from "@/lib/guestLetters";
import { useConnect } from "wagmi";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

const CONFETTI = [
  { left: "10%", dur: "2.4s", delay: "0s",    color: "#CFE94B", round: false },
  { left: "24%", dur: "2.9s", delay: "0.3s",  color: "#FF5B45", round: true  },
  { left: "40%", dur: "2.6s", delay: "0.6s",  color: "#F5EFE2", round: false },
  { left: "58%", dur: "3.1s", delay: "0.15s", color: "#CFE94B", round: true  },
  { left: "74%", dur: "2.7s", delay: "0.5s",  color: "#FF5B45", round: false },
  { left: "88%", dur: "3.3s", delay: "0.8s",  color: "#F5EFE2", round: true  },
];

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

export default function GuestBoard({ onBack }: { onBack: () => void }) {
  const { connect, connectors, isPending } = useConnect();
  const letterStr = useRef(generateGuestLetters()).current;

  const [input, setInput]     = useState("");
  const [words, setWords]     = useState<WordEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [phase, setPhase]     = useState<"active" | "done">("active");
  const [pops, setPops]       = useState<Pop[]>([]);
  const [popId, setPopId]     = useState(0);
  const [wordValid, setWordValid] = useState<"valid" | "invalid" | "unchecked">("unchecked");

  // countdown
  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); setPhase("done"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // debounced dict check
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

  const myScore = words.reduce((s, w) => s + w.pts, 0);
  const usedCounts  = getLetterCounts(input);
  const availCounts = getLetterCounts(letterStr);
  const timeStr = String(Math.floor(timeLeft / 60)).padStart(2, "0") + ":" + String(timeLeft % 60).padStart(2, "0");
  const timerColor = timeLeft > 30 ? "#F5EFE2" : timeLeft > 10 ? "#F4C84B" : "#FF5B45";
  const isActive = phase === "active" && timeLeft > 0;

  const submitWord = useCallback(() => {
    if (!isActive) return;
    const word = input.trim().toUpperCase();
    if (word.length < 2 || !canBuild(word, letterStr) || words.find((w) => w.word === word) || wordValid !== "valid") return;
    const pts = scoreWord(word);
    setWords((prev) => [...prev, { word, pts }]);
    setInput("");
    const id = popId + 1;
    setPopId(id);
    setPops((p) => [...p, { id, text: "+" + pts }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 950);
  }, [isActive, input, words, letterStr, popId, wordValid]);

  function tapTile(l: string) {
    if (!isActive) return;
    const avail = getLetterCounts(letterStr);
    const used  = getLetterCounts(input);
    if ((used[l] || 0) < (avail[l] || 0)) setInput((prev) => prev + l);
  }

  function handleConnect() {
    const c = connectors[0];
    if (c) connect({ connector: c });
  }

  const sortedWords = [...words].sort((a, b) => b.pts - a.pts);

  /* ── RESULTS ── */
  if (phase === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 1, 0.4, 1] as [number,number,number,number] }}
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
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 20, background: "#241C13", border: LINE, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", color: "#F5EFE2", textTransform: "uppercase", marginBottom: 16 }}>
              Guest Round Complete
            </div>
            <motion.div
              key={myScore}
              initial={{ scale: 1.4 }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(72px,16vw,96px)", color: "#CFE94B", lineHeight: 1 }}
            >{myScore}</motion.div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#F5EFE2", marginTop: 4 }}>points</div>

            {sortedWords.length > 0 && (
              <div style={{ width: "100%", marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {sortedWords.map(({ word, pts }) => (
                  <span key={word} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 10, background: "#241C13", border: LINE, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#F5EFE2" }}>
                    {word} <b style={{ color: pts >= 8 ? "#FF5B45" : "#CFE94B" }}>+{pts}</b>
                  </span>
                ))}
              </div>
            )}

            {/* Connect wallet CTA */}
            <div style={{ width: "100%", marginTop: 22, borderRadius: 18, padding: "clamp(18px,4vw,24px)", background: "rgba(207,233,75,.07)", border: "1px solid rgba(207,233,75,.25)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>Save your score on-chain</div>
              <p style={{ fontSize: 13, color: "#9A8C77", margin: "0 0 16px" }}>Connect a wallet to record scores, build a daily streak, and compete on the leaderboard.</p>
              <motion.button
                onClick={handleConnect}
                disabled={isPending}
                animate={{ boxShadow: ["0 6px 0 #A9C931", "0 6px 24px rgba(207,233,75,0.55)", "0 6px 0 #A9C931"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.97 }}
                style={{ width: "100%", padding: "clamp(13px,2.5vw,15px)", borderRadius: 13, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, cursor: isPending ? "wait" : "pointer", opacity: isPending ? 0.7 : 1 }}
              >
                {isPending ? "Connecting…" : "Connect Wallet"}
              </motion.button>
            </div>

            <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 10 }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={onBack}
                style={{ flex: 1, padding: "clamp(11px,2vw,13px)", borderRadius: 14, background: "none", border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                ← Back
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => window.location.reload()}
                style={{ flex: 1, padding: "clamp(11px,2vw,13px)", borderRadius: 14, background: "none", border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Play again
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── ACTIVE GUEST RACE ── */
  return (
    <div style={{ paddingTop: "clamp(8px,2vw,16px)" }}>
      <div className="flex items-center justify-between mb-3">
        <motion.button onClick={onBack} whileHover={{ opacity: 0.7 }} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77", background: "none", border: "none", cursor: "pointer", padding: 0 }}>‹ Back</motion.button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", padding: "3px 10px", borderRadius: 8, border: LINE, background: "rgba(255,91,69,.08)" }}>Guest · Not saved on-chain</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>

          {/* Stat strip */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Score", val: <motion.span key={myScore} initial={myScore > 0 ? { scale: 1.4 } : { scale: 1 }} animate={myScore > 0 ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={myScore > 0 ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : {}} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", color: "#CFE94B", lineHeight: 1.05, display: "inline-block" }}>{myScore}</motion.span> },
              { label: "Words", val: <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,5vw,30px)", color: "#F5EFE2", lineHeight: 1.05 }}>{words.length}</span> },
              { label: "Time",  val: <motion.span animate={timeLeft > 0 ? { scale: timeLeft <= 10 ? [1, 1.14, 1] : [1, 1.04, 1] } : { scale: 1 }} transition={timeLeft > 0 ? { duration: timeLeft <= 10 ? 0.6 : 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }} style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "clamp(22px,4.5vw,28px)", lineHeight: 1.12, color: timerColor, display: "inline-block" }}>{timeStr}</motion.span> },
            ].map(({ label, val }) => (
              <div key={label} style={{ flex: 1, background: "#241C13", borderRadius: 15, padding: "clamp(9px,2vw,12px)", textAlign: "center", border: LINE }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "#9A8C77", textTransform: "uppercase" }}>{label}</div>
                {val}
              </div>
            ))}
          </div>

          {/* Letter tiles */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
            {letterStr.split("").map((l, i) => {
              const isUsed = (usedCounts[l] || 0) >= (availCounts[l] || 0) && (usedCounts[l] || 0) > 0;
              const disabled = isUsed || !isActive;
              return (
                <motion.div key={i} animate={{ y: disabled ? 0 : [0, -6, 0] }} transition={disabled ? { duration: 0.3 } : { duration: 2.2 + i * 0.28, repeat: Infinity, ease: "easeInOut", delay: i * 0.21 }} style={{ display: "inline-flex" }}>
                  <motion.button onClick={() => tapTile(l)} disabled={disabled}
                    initial={{ opacity: 0, scale: 0.72, rotate: -10 }}
                    animate={{ opacity: disabled ? 0.3 : 1, scale: 1, rotate: 0 }}
                    transition={{ duration: 0.4, ease: [0.2, 1.4, 0.4, 1] as [number,number,number,number], delay: i * 0.07 }}
                    whileHover={!disabled ? { scale: 1.15 } : undefined}
                    whileTap={!disabled ? { scale: 0.84 } : undefined}
                    style={{ width: "clamp(38px,8vw,46px)", height: "clamp(44px,9vw,54px)", borderRadius: 9, background: "#F3ECDB", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,5vw,27px)", color: "#2A2017", cursor: disabled ? "default" : "pointer", boxShadow: disabled ? "inset 0 -3px 0 #CFC1A6" : "inset 0 -3px 0 #CFC1A6, 0 4px 10px rgba(0,0,0,.3)" }}>
                    {l}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>

          {/* Input */}
          {isActive && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
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
                <motion.button onClick={() => setInput((p) => p.slice(0, -1))}
                  animate={input.length > 0 ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.4 }}
                  transition={input.length > 0 ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : {}}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
                  style={{ width: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "#241C13", border: LINE, borderRadius: 13, fontSize: 18, color: "#CBC0AE", cursor: "pointer" }}>⌫</motion.button>
              </div>
              {(() => {
                const submitDisabled = input.length < 2 || !canBuild(input, letterStr) || !!words.find((w) => w.word === input) || wordValid !== "valid";
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
              {pops.map((p) => (
                <span key={p.id} className="animate-float-up absolute pointer-events-none"
                  style={{ left: "50%", top: 30, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 38, color: "#CFE94B", textShadow: "0 3px 12px rgba(0,0,0,.5)" }}>
                  {p.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Found words */}
        <AnimatePresence>
          {words.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}
              style={{ flex: "1 1 220px", minWidth: 0, background: "#241C13", border: LINE, borderRadius: 18, padding: "clamp(12px,3vw,18px)", alignSelf: "flex-start" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "#9A8C77", textTransform: "uppercase", marginBottom: 10 }}>Found words</div>
              <AnimatePresence initial={false}>
                {[...words].reverse().map(({ word, pts }) => (
                  <motion.div key={word} initial={{ opacity: 0, x: 16, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0, x: -16, height: 0 }} transition={{ duration: 0.28, ease: [0.2, 1, 0.4, 1] as [number,number,number,number] }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: LINE, overflow: "hidden" }}>
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
