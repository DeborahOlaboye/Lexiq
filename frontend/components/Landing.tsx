"use client";

const HERO_TILES = [
  { l: "R", r: "-4deg", dur: "4s",   delay: "0s" },
  { l: "E", r: "3deg",  dur: "4.4s", delay: "0.2s" },
  { l: "T", r: "-2deg", dur: "3.8s", delay: "0.4s" },
  { l: "A", r: "4deg",  dur: "4.6s", delay: "0.1s" },
  { l: "I", r: "-3deg", dur: "4.1s", delay: "0.3s" },
  { l: "N", r: "2deg",  dur: "3.9s", delay: "0.5s" },
  { l: "S", r: "-1deg", dur: "4.3s", delay: "0.15s" },
];

const ONBOARD_TILES = [
  { l: "L", lime: false, delay: "0s" },
  { l: "E", lime: false, delay: "0.08s" },
  { l: "X", lime: false, delay: "0.16s" },
  { l: "I", lime: false, delay: "0.24s" },
  { l: "Q", lime: true,  delay: "0.32s" },
];

const LINE = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

export default function Landing({ isConnecting }: { isConnecting: boolean }) {
  return (
    <div className="min-h-screen bg-ink text-cream font-ui overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="flex items-center justify-between max-w-[1080px] mx-auto px-10 py-[22px]">
        <div className="flex items-center gap-[11px]">
          <div
            className="w-[30px] h-[34px] rounded-[6px] bg-tile flex items-center justify-center font-display font-extrabold text-[20px] text-tileink"
            style={{ boxShadow: "inset 0 -3px 0 #CFC1A6" }}
          >
            L
          </div>
          <span className="font-display font-extrabold text-[21px] tracking-[-0.01em]">Lexiq</span>
        </div>
        <div className="hidden md:flex items-center gap-[30px]">
          <span className="text-sm text-creamdim cursor-pointer hover:text-cream transition-colors">How it works</span>
          <span className="text-sm text-creamdim cursor-pointer hover:text-cream transition-colors">Scoring</span>
          <span className="text-sm text-creamdim cursor-pointer hover:text-cream transition-colors">Leaderboard</span>
          <span className="inline-flex items-center px-[18px] py-[10px] rounded-[11px] bg-lime text-ink font-display font-extrabold text-sm cursor-pointer">
            Play on MiniPay
          </span>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="max-w-[1080px] mx-auto px-10 pt-[46px] pb-[30px] grid md:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
        <div>
          <div
            className="inline-flex items-center gap-2 px-[13px] py-[7px] rounded-full font-mono text-[11px] tracking-[0.12em] uppercase text-lime"
            style={{ border: LINE2 }}
          >
            <span className="w-[7px] h-[7px] rounded-full bg-lime animate-blink" />
            On-chain word race · Celo
          </div>
          <h1 className="font-display font-extrabold text-[52px] md:text-[62px] leading-[0.96] tracking-[-0.025em] mt-5">
            Seven letters.<br />Ninety seconds.<br />
            <span className="text-lime">One shot.</span>
          </h1>
          <p className="text-[18px] leading-[1.55] text-creamdim max-w-[430px] mt-[22px]">
            Build as many words as you can from 7 random letters. Longer words score more. Stake USDM, beat your best,
            and climb the weekly prize board.
          </p>
          <div className="flex flex-wrap gap-[14px] mt-[30px]">
            <button
              className="inline-flex items-center gap-[9px] px-[26px] py-[16px] rounded-[14px] bg-lime text-ink font-display font-extrabold text-[17px]"
              style={{ boxShadow: "0 6px 0 #A9C931" }}
            >
              {isConnecting ? "Connecting…" : "Play on MiniPay"}
            </button>
            <button
              className="inline-flex items-center gap-[9px] px-[24px] py-[16px] rounded-[14px] text-cream font-display font-bold text-[17px]"
              style={{ border: LINE2 }}
            >
              How it works
            </button>
          </div>
          <div className="flex gap-[22px] mt-[26px] font-mono text-[12px] text-muted">
            <span>↳ Settled on Celo</span>
            <span>· USDM</span>
            <span>· No sign-up</span>
          </div>
        </div>

        {/* Hero art */}
        <div className="relative h-[420px] hidden md:block">
          <div className="absolute top-[120px] left-1/2 -translate-x-1/2 flex gap-[7px]">
            {HERO_TILES.map(({ l, r, dur, delay }) => (
              <div
                key={l}
                className="animate-floaty w-[54px] h-[62px] rounded-[9px] bg-tile flex items-center justify-center font-display font-extrabold text-[32px] text-tileink"
                style={{
                  "--r": r,
                  "--dur": dur,
                  "--delay": delay,
                  boxShadow: "inset 0 -4px 0 #CFC1A6, 0 8px 18px rgba(0,0,0,.35)",
                } as React.CSSProperties}
              >
                {l}
              </div>
            ))}
          </div>
          <div
            className="absolute top-[36px] right-2 bg-coral text-white p-[13px_18px] rounded-[14px] rotate-[5deg]"
            style={{ boxShadow: "0 10px 26px rgba(255,91,69,.4)" }}
          >
            <div className="font-mono text-[10px] opacity-85 tracking-[0.1em]">RETAINS</div>
            <div className="font-display font-extrabold text-[30px] leading-none">+11</div>
          </div>
          <div
            className="absolute bottom-10 left-0 bg-panel p-[11px_16px] rounded-[13px] -rotate-[4deg]"
            style={{ border: LINE }}
          >
            <div className="font-mono text-[10px] text-muted tracking-[0.1em]">TIME</div>
            <div className="font-mono font-bold text-[26px] text-cream leading-none">01:30</div>
          </div>
          <div
            className="absolute bottom-[54px] right-6 bg-panel p-[11px_16px] rounded-[13px] rotate-[3deg]"
            style={{ border: LINE }}
          >
            <div className="font-mono text-[10px] text-muted tracking-[0.1em]">YOUR BEST</div>
            <div className="font-display font-extrabold text-[26px] text-lime leading-none">47</div>
          </div>
        </div>
      </div>

      {/* ── STATS BAND ── */}
      <div className="max-w-[1080px] mx-auto px-10 mt-[18px]">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-[14px] py-[26px]"
          style={{ borderTop: LINE, borderBottom: LINE }}
        >
          {[
            { val: "90s",    label: "per round",        lime: false },
            { val: "7",      label: "random letters",   lime: false },
            { val: "11 pts", label: "top word score",   lime: true  },
            { val: "USDM",   label: "weekly prize pool", lime: false },
          ].map(({ val, label, lime }) => (
            <div key={val}>
              <div className={`font-display font-extrabold text-[34px] leading-none ${lime ? "text-lime" : "text-cream"}`}>
                {val}
              </div>
              <div className="text-[13px] text-muted mt-[5px]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div className="max-w-[1080px] mx-auto px-10 pt-[64px] pb-5">
        <h2 className="font-display font-extrabold text-[38px] tracking-[-0.02em] mb-[6px]">How it works</h2>
        <p className="text-muted text-[16px] mb-[36px]">No opponents to wait for. Just you, the clock, and the chain.</p>
        <div className="grid md:grid-cols-3 gap-[18px]">
          {[
            {
              n: "01", title: "Get your 7 letters",
              body: "Seven random letters drawn from a keccak256 seed of live block data. Provably fair, fresh every round.",
            },
            {
              n: "02", title: "Spell against the clock",
              body: "Tap tiles or type. Each word is committed on-chain as you go. Longer words are worth far more.",
            },
            {
              n: "03", title: "Reveal & score",
              body: "At the buzzer your words reveal and tally. Beat 10 points to keep your stake — or feed the pool.",
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="bg-panel rounded-[20px] p-[28px]" style={{ border: LINE }}>
              <div className="font-display font-extrabold text-[15px] text-lime tracking-[0.1em]">{n}</div>
              <div className="font-display font-bold text-[22px] mt-[14px] mb-2">{title}</div>
              <p className="text-creamdim text-[15px] leading-[1.5] m-0">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SCORING LADDER ── */}
      <div className="max-w-[1080px] mx-auto px-10 pt-[56px] pb-5">
        <div className="grid md:grid-cols-[0.8fr_1.2fr] gap-10 items-center">
          <div>
            <h2 className="font-display font-extrabold text-[38px] tracking-[-0.02em] mb-3">
              Length is everything
            </h2>
            <p className="text-creamdim text-[16px] leading-[1.55] m-0">
              Two-letter words barely register. The seven-letter bomb is the jackpot. The whole game is the hunt
              for one more long word before the buzzer.
            </p>
          </div>
          <div className="flex flex-col gap-2 mt-8 md:mt-0">
            {[
              { label: "2 L",  pts: "1 pt",   w: "14%",  bar: "var(--line2)",            jackpot: false },
              { label: "3 L",  pts: "2 pts",  w: "24%",  bar: "var(--line2)",            jackpot: false },
              { label: "4 L",  pts: "3 pts",  w: "34%",  bar: "rgba(207,233,75,.4)",     jackpot: false },
              { label: "5 L",  pts: "5 pts",  w: "50%",  bar: "rgba(207,233,75,.6)",     jackpot: false },
              { label: "6 L",  pts: "8 pts",  w: "70%",  bar: "#CFE94B",                jackpot: false },
              { label: "7 L+", pts: "11 pts", w: "100%", bar: "#FF5B45",                jackpot: true  },
            ].map(({ label, pts, w, bar, jackpot }) => (
              <div key={label} className="flex items-center gap-3">
                <span className={`w-[52px] font-mono text-[13px] shrink-0 ${jackpot ? "text-coral" : "text-muted"}`}>
                  {label}
                </span>
                {jackpot ? (
                  <div
                    className="h-[38px] flex-1 rounded-[8px] flex items-center pl-[14px] font-display font-extrabold text-white text-[14px] tracking-[0.08em]"
                    style={{ background: bar }}
                  >
                    JACKPOT
                  </div>
                ) : (
                  <div className="h-[30px] rounded-[8px]" style={{ width: w, background: bar }} />
                )}
                <span
                  className={`font-display font-bold text-[15px] shrink-0 ${jackpot ? "text-coral text-[18px] font-extrabold" : "text-creamdim"}`}
                >
                  {pts}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STAKE / PRIZE ── */}
      <div className="max-w-[1080px] mx-auto px-10 pt-[56px] pb-5">
        <div className="grid md:grid-cols-2 gap-[18px]">
          <div className="bg-panel rounded-[20px] p-[30px]" style={{ border: LINE }}>
            <div className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Free to play</div>
            <div className="font-display font-extrabold text-[26px] mt-3 mb-2">Just for the high score</div>
            <p className="text-creamdim text-[15px] leading-[1.5] m-0">
              Skip the stake entirely. Chase your personal best and climb the board on pure skill.
            </p>
          </div>
          <div
            className="rounded-[20px] p-[30px]"
            style={{ background: "linear-gradient(135deg,rgba(255,91,69,.16),rgba(207,233,75,.10))", border: "1px solid rgba(255,91,69,.35)" }}
          >
            <div className="font-mono text-[11px] tracking-[0.14em] text-coral uppercase">Stake to sweat</div>
            <div className="font-display font-extrabold text-[26px] mt-3 mb-2">Score 10+ or lose it</div>
            <p className="text-creamdim text-[15px] leading-[1.5] m-0">
              Stake USDM before the round. Beat 10 points and it comes back (minus 1%). Fall short and it drops
              into the weekly pool.
            </p>
          </div>
        </div>
        <div
          className="mt-[18px] bg-ink2 rounded-[20px] p-[30px] flex items-center justify-between flex-wrap gap-5"
          style={{ border: LINE }}
        >
          <div>
            <div className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">This week's prize pool</div>
            <div className="font-display font-extrabold text-[46px] text-lime leading-none mt-2">
              128.40{" "}
              <span className="text-[22px] text-creamdim font-bold">USDM</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[12px] text-muted">Resets in</div>
            <div className="font-mono font-bold text-[26px] text-cream">3d 14h 22m</div>
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div className="max-w-[1080px] mx-auto px-10 mt-16">
        <div className="bg-lime rounded-[26px] p-[54px_44px] text-center">
          <h2 className="font-display font-extrabold text-[46px] tracking-[-0.02em] text-ink m-0">
            Got 90 seconds?
          </h2>
          <p className="text-[#3c4416] text-[17px] mt-3 mb-[26px]">
            Open Lexiq in MiniPay. Your wallet connects automatically.
          </p>
          <button className="inline-flex items-center gap-[10px] px-[34px] py-[17px] rounded-[14px] bg-ink text-lime font-display font-extrabold text-[18px]">
            Play on MiniPay
          </button>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div
        className="max-w-[1080px] mx-auto px-10 mt-12 pb-[46px] pt-[30px] flex items-center justify-between flex-wrap gap-[14px]"
        style={{ borderTop: LINE }}
      >
        <div className="flex items-center gap-[10px]">
          <span className="font-display font-extrabold text-[17px]">Lexiq</span>
          <span className="text-[13px] text-muted">· Solo word race on Celo</span>
        </div>
        <div className="font-mono text-[11px] text-muted">USDM · 0x765D…282a · chainId 42220</div>
      </div>

      {/* ── MOBILE ONBOARDING CTA (shown below the fold on small screens) ── */}
      <div className="md:hidden max-w-[390px] mx-auto px-6 pb-16">
        <div className="flex justify-center gap-[6px] mb-6">
          {ONBOARD_TILES.map(({ l, lime, delay }) => (
            <div
              key={l}
              className="animate-tile-in w-[42px] h-[50px] rounded-[8px] flex items-center justify-center font-display font-extrabold text-[26px]"
              style={{
                "--delay": delay,
                background: lime ? "#CFE94B" : "#F3ECDB",
                color: lime ? "#15110D" : "#2A2017",
                boxShadow: lime
                  ? "inset 0 -3px 0 #A9C931, 0 6px 14px rgba(0,0,0,.35)"
                  : "inset 0 -3px 0 #CFC1A6, 0 6px 14px rgba(0,0,0,.35)",
              } as React.CSSProperties}
            >
              {l}
            </div>
          ))}
        </div>
        <button
          className="flex items-center justify-center w-full py-[16px] rounded-[16px] bg-lime text-ink font-display font-extrabold text-[17px]"
          style={{ boxShadow: "0 6px 0 #A9C931" }}
        >
          {isConnecting ? "Connecting…" : "Open in MiniPay"}
        </button>
        <div className="flex items-center justify-center gap-[7px] mt-3 font-mono text-[11px] text-muted">
          <span className="w-[6px] h-[6px] rounded-full bg-lime animate-blink" />
          Auto-connects your wallet · Mainnet
        </div>
      </div>
    </div>
  );
}
