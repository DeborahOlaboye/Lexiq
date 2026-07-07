"use client";
import { useConnect } from "wagmi";
import { motion } from "framer-motion";

const HERO_TILES = [
  { l: "R", r: "-4deg", dur: "4s",   delay: "0s" },
  { l: "E", r: "3deg",  dur: "4.4s", delay: "0.2s" },
  { l: "T", r: "-2deg", dur: "3.8s", delay: "0.4s" },
  { l: "A", r: "4deg",  dur: "4.6s", delay: "0.1s" },
  { l: "I", r: "-3deg", dur: "4.1s", delay: "0.3s" },
  { l: "N", r: "2deg",  dur: "3.9s", delay: "0.5s" },
  { l: "S", r: "-1deg", dur: "4.3s", delay: "0.15s" },
];

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

const fadeUp  = (delay = 0) => ({
  initial:    { opacity: 0, y: 28 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.6, ease: [0.2, 1, 0.4, 1] as [number, number, number, number], delay },
});

const inView  = (delay = 0) => ({
  initial:    { opacity: 0, y: 22 },
  whileInView:{ opacity: 1, y: 0  },
  viewport:   { once: false, amount: 0.15 },
  transition: { duration: 0.55, ease: [0.2, 1, 0.4, 1] as [number, number, number, number], delay },
});

const SCORING_ROWS = [
  { label: "2 L",  pts: "1 pt",   w: "14%",  bar: "var(--line2)",        jackpot: false },
  { label: "3 L",  pts: "2 pts",  w: "24%",  bar: "var(--line2)",        jackpot: false },
  { label: "4 L",  pts: "3 pts",  w: "34%",  bar: "rgba(207,233,75,.4)", jackpot: false },
  { label: "5 L",  pts: "5 pts",  w: "50%",  bar: "rgba(207,233,75,.6)", jackpot: false },
  { label: "6 L",  pts: "8 pts",  w: "70%",  bar: "#CFE94B",             jackpot: false },
  { label: "7 L+", pts: "11 pts", w: "100%", bar: "#FF5B45",             jackpot: true  },
];

export default function Landing() {
  const { connect, connectors, isPending } = useConnect();

  function handleConnect() {
    const connector = connectors[0];
    if (connector) connect({ connector });
  }

  return (
    <div className="min-h-dvh bg-ink text-cream font-ui overflow-x-hidden">

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(10px)", background: "rgba(21,17,13,.72)", borderBottom: LINE }}>
        <div className="flex items-center justify-between" style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "0 clamp(18px,5vw,40px)", height: 60 }}>
          <div className="flex items-center gap-[11px]">
            <div style={{ width: 28, height: 32, borderRadius: 6, background: "#F3ECDB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#2A2017", boxShadow: "inset 0 -2px 0 #CFC1A6" }}>L</div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#F5EFE2" }}>Lexiq</span>
          </div>
          <motion.button onClick={handleConnect} disabled={isPending} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            style={{ padding: "10px 20px", borderRadius: 11, background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, cursor: isPending ? "wait" : "pointer", opacity: isPending ? 0.7 : 1, border: "none" }}>
            {isPending ? "Connecting…" : "Connect Wallet"}
          </motion.button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "clamp(40px,8vw,80px) clamp(18px,5vw,40px) clamp(20px,4vw,40px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(30px,5vw,60px)", alignItems: "center" }}>

        {/* Copy */}
        <div>
          <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2"
            style={{ padding: "7px 13px", borderRadius: 20, border: LINE2, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#CFE94B" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#CFE94B", display: "inline-block", animation: "blink 1.4s infinite" }} />
            On-chain word race · Celo
          </motion.div>

          <motion.h1 {...fadeUp(0.1)}
            style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(40px,8vw,64px)", lineHeight: 0.96, letterSpacing: "-0.025em", marginTop: 20, marginBottom: 0, color: "#F5EFE2" }}>
            Seven letters.<br />Ninety seconds.<br />
            <span style={{ color: "#CFE94B" }}>One shot.</span>
          </motion.h1>

          <motion.p {...fadeUp(0.22)} style={{ fontSize: "clamp(15px,2vw,18px)", lineHeight: 1.55, color: "#CBC0AE", maxWidth: 430, marginTop: 20, marginBottom: 0 }}>
            Build as many words as you can from 7 random letters. Longer words score more. Stake USDM, beat your best, and climb the weekly prize board.
          </motion.p>

          <motion.div {...fadeUp(0.34)} className="flex flex-wrap gap-[14px]" style={{ marginTop: "clamp(20px,3vw,30px)" }}>
            <motion.button
              onClick={handleConnect}
              disabled={isPending}
              animate={!isPending ? { boxShadow: ["0 6px 0 #A9C931", "0 6px 28px rgba(207,233,75,0.65)", "0 6px 0 #A9C931"], y: [0, -3, 0] } : {}}
              transition={!isPending ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : {}}
              whileHover={!isPending ? { scale: 1.04, y: -4 } : undefined}
              whileTap={!isPending ? { scale: 0.97 } : undefined}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "clamp(12px,2vw,16px) clamp(20px,3vw,26px)", borderRadius: 14, background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2vw,17px)", cursor: isPending ? "wait" : "pointer", opacity: isPending ? 0.7 : 1, border: "none" }}>
              {isPending ? "Connecting…" : "Connect Wallet"}
            </motion.button>
            <motion.a href="#how" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ display: "inline-flex", alignItems: "center", padding: "clamp(12px,2vw,16px) clamp(20px,3vw,24px)", borderRadius: 14, border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(15px,2vw,17px)", textDecoration: "none" }}>
              How it works
            </motion.a>
          </motion.div>

          <motion.div {...fadeUp(0.44)} style={{ display: "flex", flexWrap: "wrap", columnGap: 22, rowGap: 4, marginTop: 20, fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77" }}>
            <span>↳ Settled on Celo</span><span>· USDM</span><span>· No sign-up</span><span>· Phone & laptop</span>
          </motion.div>
        </div>

        {/* Floating tiles art */}
        <div style={{ position: "relative", minHeight: "clamp(200px,40vw,380px)" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", gap: 7 }}>
            {HERO_TILES.map(({ l, r, dur, delay }, i) => (
              <motion.div key={l}
                initial={{ opacity: 0, y: 20, rotate: -10 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 1.4, 0.4, 1] as [number, number, number, number], delay: 0.1 + i * 0.07 }}
                className="animate-floaty"
                style={{ "--r": r, "--dur": dur, "--delay": delay, width: "clamp(36px,6vw,54px)", height: "clamp(42px,7vw,62px)", borderRadius: 9, background: "#F3ECDB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(20px,3.5vw,32px)", color: "#2A2017", boxShadow: "inset 0 -4px 0 #CFC1A6, 0 8px 18px rgba(0,0,0,.35)" } as React.CSSProperties}>
                {l}
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: 10 }}
            animate={{ opacity: 1, scale: 1, rotate: 5, y: [0, -12, 0] }}
            transition={{ opacity: { duration: 0.5, ease: [0.2, 1.6, 0.4, 1] as [number,number,number,number], delay: 0.4 }, scale: { duration: 0.5, ease: [0.2, 1.6, 0.4, 1] as [number,number,number,number], delay: 0.4 }, rotate: { duration: 0.5, delay: 0.4 }, y: { duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 1.0 } }}
            style={{ position: "absolute", top: "8%", right: "4%", background: "#FF5B45", color: "white", padding: "13px 18px", borderRadius: 14, boxShadow: "0 10px 26px rgba(255,91,69,.4)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.85, letterSpacing: "0.1em" }}>RETAINS</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, lineHeight: 1 }}>+11</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: -4, y: [0, -9, 0] }}
            transition={{ opacity: { duration: 0.5, ease: [0.2, 1.6, 0.4, 1] as [number,number,number,number], delay: 0.52 }, scale: { duration: 0.5, ease: [0.2, 1.6, 0.4, 1] as [number,number,number,number], delay: 0.52 }, rotate: { duration: 0.5, delay: 0.52 }, y: { duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 1.2 } }}
            style={{ position: "absolute", bottom: "10%", left: "4%", background: "#241C13", border: LINE, padding: "11px 16px", borderRadius: 13 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", letterSpacing: "0.1em" }}>TIME</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 26, color: "#F5EFE2", lineHeight: 1 }}>01:30</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: 6 }}
            animate={{ opacity: 1, scale: 1, rotate: 3, y: [0, -14, 0] }}
            transition={{ opacity: { duration: 0.5, ease: [0.2, 1.6, 0.4, 1] as [number,number,number,number], delay: 0.62 }, scale: { duration: 0.5, ease: [0.2, 1.6, 0.4, 1] as [number,number,number,number], delay: 0.62 }, rotate: { duration: 0.5, delay: 0.62 }, y: { duration: 3.9, repeat: Infinity, ease: "easeInOut", delay: 1.4 } }}
            style={{ position: "absolute", bottom: "24%", right: "8%", background: "#241C13", border: LINE, padding: "11px 16px", borderRadius: 13 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#9A8C77", letterSpacing: "0.1em" }}>YOUR BEST</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#CFE94B", lineHeight: 1 }}>47</div>
          </motion.div>
        </div>
      </div>

      {/* Connect subtext */}
      <motion.div {...inView()} style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "0 clamp(18px,5vw,40px) clamp(20px,3vw,40px)", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77", margin: 0 }}>Connect your wallet — it works the same on your phone and your laptop</p>
      </motion.div>

      {/* STATS BAND */}
      <div style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "0 clamp(18px,5vw,40px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, padding: "clamp(18px,4vw,26px) 0", borderTop: LINE, borderBottom: LINE }}>
          {[
            { val: "90s",    label: "per round",         lime: false },
            { val: "7",      label: "random letters",    lime: false },
            { val: "11 pts", label: "top word score",    lime: true  },
            { val: "USDM",   label: "weekly prize pool", lime: false },
          ].map(({ val, label, lime }, i) => (
            <motion.div key={val} {...inView(i * 0.1)}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,5vw,34px)", lineHeight: 1, color: lime ? "#CFE94B" : "#F5EFE2" }}>{val}</div>
              <div style={{ fontSize: 13, color: "#9A8C77", marginTop: 5 }}>{label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "clamp(40px,6vw,64px) clamp(18px,5vw,40px) 20px" }}>
        <motion.h2 {...inView(0)} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px,5vw,38px)", letterSpacing: "-0.02em", margin: "0 0 6px" }}>How it works</motion.h2>
        <motion.p {...inView(0.08)} style={{ color: "#9A8C77", fontSize: 16, marginBottom: 36 }}>No opponents to wait for. Just you, the clock, and the chain.</motion.p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          {[
            { n: "01", title: "Get your 7 letters",     body: "Seven random letters drawn from a keccak256 seed of live block data. Provably fair, fresh every round." },
            { n: "02", title: "Spell against the clock", body: "Tap tiles or type. Each word is committed on-chain as you go. Longer words are worth far more." },
            { n: "03", title: "Reveal & score",          body: "At the buzzer your words reveal and tally. Beat 10 points to keep your stake — or feed the pool." },
          ].map(({ n, title, body }, i) => (
            <motion.div key={n} {...inView(0.18 + i * 0.12)} whileHover={{ y: -4, transition: { duration: 0.2 } }}
              style={{ background: "#241C13", borderRadius: 20, padding: "clamp(18px,3vw,28px)", border: LINE }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "#CFE94B", letterSpacing: "0.1em" }}>{n}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(17px,2.5vw,22px)", marginTop: 14, marginBottom: 8 }}>{title}</div>
              <p style={{ color: "#CBC0AE", fontSize: 15, lineHeight: 1.5, margin: 0 }}>{body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* SCORING LADDER */}
      <div style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "clamp(36px,6vw,56px) clamp(18px,5vw,40px) 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(24px,5vw,40px)", alignItems: "center" }}>
          <div>
            <motion.h2 {...inView(0)} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px,5vw,38px)", letterSpacing: "-0.02em", marginBottom: 12 }}>Length is everything</motion.h2>
            <motion.p {...inView(0.1)} style={{ color: "#CBC0AE", fontSize: 16, lineHeight: 1.55, margin: 0 }}>
              Two-letter words barely register. The seven-letter bomb is the jackpot. The whole game is the hunt for one more long word before the buzzer.
            </motion.p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SCORING_ROWS.map(({ label, pts, w, bar, jackpot }, i) => (
              <motion.div key={label} {...inView(0.08 + i * 0.07)} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 52, fontFamily: "var(--font-mono)", fontSize: 13, flexShrink: 0, color: jackpot ? "#FF5B45" : "#9A8C77" }}>{label}</span>
                {jackpot ? (
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={{ once: false, amount: 0.5 }}
                    transition={{ duration: 0.7, ease: [0.2, 1, 0.4, 1] as [number, number, number, number], delay: 0.15 + i * 0.07 }}
                    style={{ height: 38, flex: 1, borderRadius: 8, background: bar, display: "flex", alignItems: "center", paddingLeft: 14, fontFamily: "var(--font-display)", fontWeight: 800, color: "white", fontSize: 14, letterSpacing: "0.08em", overflow: "hidden" }}>JACKPOT</motion.div>
                ) : (
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: w }} viewport={{ once: false, amount: 0.5 }}
                    transition={{ duration: 0.6, ease: [0.2, 1, 0.4, 1] as [number, number, number, number], delay: 0.2 + i * 0.07 }}
                    style={{ height: 30, borderRadius: 8, background: bar, flexShrink: 0 }} />
                )}
                <span style={{ fontFamily: "var(--font-display)", fontWeight: jackpot ? 800 : 700, fontSize: jackpot ? 18 : 15, flexShrink: 0, color: jackpot ? "#FF5B45" : "#CBC0AE" }}>{pts}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* STAKE / PRIZE */}
      <div style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "clamp(36px,6vw,56px) clamp(18px,5vw,40px) 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <motion.div {...inView(0)} whileHover={{ y: -3, transition: { duration: 0.2 } }}
            style={{ background: "#241C13", borderRadius: 20, padding: "clamp(20px,3vw,30px)", border: LINE }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "#9A8C77", textTransform: "uppercase" }}>Free to play</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,2.5vw,26px)", marginTop: 12, marginBottom: 8 }}>Just for the high score</div>
            <p style={{ color: "#CBC0AE", fontSize: 15, lineHeight: 1.5, margin: 0 }}>Skip the stake entirely. Chase your personal best and climb the board on pure skill.</p>
          </motion.div>
          <motion.div {...inView(0.1)} whileHover={{ y: -3, transition: { duration: 0.2 } }}
            style={{ borderRadius: 20, padding: "clamp(20px,3vw,30px)", background: "linear-gradient(135deg,rgba(255,91,69,.16),rgba(207,233,75,.10))", border: "1px solid rgba(255,91,69,.35)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "#FF5B45", textTransform: "uppercase" }}>Stake to sweat</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,2.5vw,26px)", marginTop: 12, marginBottom: 8 }}>Score 10+ or lose it</div>
            <p style={{ color: "#CBC0AE", fontSize: 15, lineHeight: 1.5, margin: 0 }}>Stake USDM before the round. Beat 10 points and it comes back (minus 1%). Fall short and it drops into the weekly pool.</p>
          </motion.div>
        </div>
        <motion.div {...inView(0.15)}
          style={{ marginTop: 18, background: "#1E1710", borderRadius: 20, padding: "clamp(20px,3vw,30px)", border: LINE, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "#9A8C77", textTransform: "uppercase" }}>This week&apos;s prize pool</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,6vw,46px)", color: "#CFE94B", lineHeight: 1, marginTop: 8 }}>
              128.40{" "}<span style={{ fontSize: "clamp(16px,2.5vw,22px)", color: "#CBC0AE", fontWeight: 700 }}>USDM</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9A8C77" }}>Resets in</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 26, color: "#F5EFE2" }}>3d 14h 22m</div>
          </div>
        </motion.div>
      </div>

      {/* FINAL CTA */}
      <div style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "clamp(36px,6vw,64px) clamp(18px,5vw,40px)" }}>
        <motion.div {...inView(0)} style={{ background: "#CFE94B", borderRadius: 26, padding: "clamp(36px,6vw,54px) clamp(24px,4vw,44px)", textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,6vw,46px)", letterSpacing: "-0.02em", color: "#15110D", margin: "0 0 12px" }}>Got 90 seconds?</h2>
          <p style={{ color: "#3c4416", fontSize: "clamp(14px,2vw,17px)", margin: "0 0 26px" }}>Connect your wallet — it works the same on your phone and your laptop.</p>
          <motion.button onClick={handleConnect} disabled={isPending} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "clamp(13px,2vw,17px) clamp(26px,4vw,34px)", borderRadius: 14, background: "#15110D", color: "#CFE94B", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(15px,2vw,18px)", cursor: isPending ? "wait" : "pointer", opacity: isPending ? 0.7 : 1, border: "none" }}>
            {isPending ? "Connecting…" : "Connect Wallet"}
          </motion.button>
        </motion.div>
      </div>

      {/* FOOTER */}
      <div style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "clamp(20px,4vw,30px) clamp(18px,5vw,40px) clamp(30px,5vw,46px)", borderTop: LINE, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div className="flex items-center gap-[10px]">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17 }}>Lexiq</span>
          <span style={{ fontSize: 13, color: "#9A8C77" }}>· Solo word race on Celo</span>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77" }}>USDM · 0x765D…282a · chainId 42220</div>
      </div>
    </div>
  );
}
