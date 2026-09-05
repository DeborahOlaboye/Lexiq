"use client";
import { useEffect, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { usePrivy, useLogin, useLogout } from "@privy-io/react-auth";
import { celo } from "wagmi/chains";
import Landing from "@/components/Landing";
import Logo from "@/components/Logo";
import GameLobby from "@/components/GameLobby";
import GameBoard from "@/components/GameBoard";
import GuestBoard from "@/components/GuestBoard";
import GuestLobby from "@/components/GuestLobby";
import Leaderboard from "@/components/Leaderboard";
import StreakBadge from "@/components/StreakBadge";
import UsernamePrompt from "@/components/UsernamePrompt";
import UsernameSetup from "@/components/UsernameSetup";
import LegalLinks from "@/components/LegalLinks";
import { getStoredUsername, getRankTitle, getXP, getLocalStreak } from "@/lib/player";
import { usePlayerPoints } from "@/hooks/usePlayerPoints";
import { isMiniPay } from "@/lib/minipay";
import { useProfile } from "@/hooks/useProfile";
import type { Lang } from "@/lib/guestLetters";

type View = "lobby" | "game" | "leaderboard";
type GuestView = "setup" | "lobby" | "game" | "leaderboard";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin({ onComplete: () => { setGuestMode(false); setView("lobby"); } });
  const { logout } = useLogout({ onSuccess: () => {} });
  const { address, isConnected: wagmiConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();

  // Inside MiniPay the wallet auto-connects via wagmi (no Privy login flow runs),
  // so gate on the wagmi connection there instead of waiting on Privy's authenticated state.
  //
  // `null` means "not detected yet". We must not treat that as `false`: rendering the
  // pre-detection frame as a non-MiniPay one flashes <Landing>, which carries a Sign In
  // button — and MiniPay's zero-click-connect rule forbids showing one inside MiniPay.
  const [inMiniPay, setInMiniPay] = useState<boolean | null>(null);
  useEffect(() => {
    // MiniPay normally injects window.ethereum before page scripts run, but poll briefly
    // so a provider that lands a tick late still resolves as MiniPay rather than falling
    // through to the sign-in landing page.
    let tries = 0;
    const settle = () => {
      if (isMiniPay()) { setInMiniPay(true); return true; }
      if (++tries >= 10) { setInMiniPay(false); return true; }
      return false;
    };
    if (settle()) return;
    const t = setInterval(() => { if (settle()) clearInterval(t); }, 100);
    return () => clearInterval(t);
  }, []);
  const isConnected = inMiniPay === true ? wagmiConnected : ready && authenticated;
  const points = usePlayerPoints();

  // Give MiniPay's auto-connect a few seconds before offering guest play as an escape
  // hatch, so a wallet handshake that never resolves can't dead-end the user.
  const [connectTimedOut, setConnectTimedOut] = useState(false);
  useEffect(() => {
    if (inMiniPay !== true || wagmiConnected) return;
    const t = setTimeout(() => setConnectTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [inMiniPay, wagmiConnected]);

  // Wallet-keyed identity. Gates the connected flow behind sign-up.
  const profile = useProfile(address);

  const [view, setView]             = useState<View>("lobby");
  const [activeRoundId, setActiveRoundId] = useState<bigint | null>(null);
  const [guestMode, setGuestMode]   = useState(false);
  const [guestView, setGuestView]   = useState<GuestView>("lobby");
  const [guestDifficulty, setGuestDifficulty] = useState<0 | 1 | 2>(1);
  const [guestLang,       setGuestLang]       = useState<Lang>("en");
  const [authLang,        setAuthLang]        = useState<Lang>("en");

  function handleGuestPlay() {
    setGuestMode(true);
    if (!getStoredUsername()) {
      setGuestView("setup");
    } else {
      setGuestView("lobby");
    }
  }

  // ── MINIPAY HANDSHAKE ───────────────────────────────────────────────────────
  // Covers both "still detecting" and "detected MiniPay, wallet not connected yet".
  // Deliberately renders before every other branch so no sign-in affordance can appear
  // inside MiniPay. The only escape hatch offered is guest play, never a wallet button.
  if (inMiniPay === null || (inMiniPay && !wagmiConnected && !guestMode)) {
    return (
      <div className="min-h-dvh bg-ink text-cream font-ui flex flex-col items-center justify-center gap-4" style={{ padding: 24 }}>
        <Logo size="md" />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6E6557" }}>
          {inMiniPay === null ? "Starting…" : "Connecting your wallet…"}
        </span>
        {connectTimedOut && (
          <button onClick={handleGuestPlay}
            style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, padding: "9px 18px", borderRadius: 10, border: LINE2, background: "none", color: "#F5EFE2", cursor: "pointer" }}>
            Play free instead
          </button>
        )}
        <LegalLinks />
      </div>
    );
  }

  // ── GUEST MODE ──────────────────────────────────────────────────────────────
  if (!isConnected && guestMode) {
    const { count: streak, lastDate } = typeof window !== "undefined" ? getLocalStreak() : { count: 0, lastDate: "" };
    const today = typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "";
    const lastPlayedToday = lastDate === today;
    const username = typeof window !== "undefined" ? getStoredUsername() : null;
    const xp    = typeof window !== "undefined" ? getXP() : 0;
    const rank  = getRankTitle(xp);

    return (
      <div className="min-h-dvh bg-ink text-cream font-ui flex flex-col">

        {/* App bar */}
        <header style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(10px)", background: "rgba(21,17,13,.78)", borderBottom: LINE }}>
          <div className="flex items-center justify-between gap-3" style={{ width: "min(960px, 100%)", margin: "0 auto", padding: "12px clamp(16px,4vw,24px)" }}>
            <button onClick={() => setGuestView("lobby")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <Logo size="sm" />
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Streak chip */}
              {streak > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 100, background: "rgba(255,91,69,.16)", border: "1px solid rgba(255,91,69,.4)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#FF5B45", whiteSpace: "nowrap" }}>
                  DAY {streak} {lastPlayedToday ? "▲" : "·"}
                </span>
              )}
              {/* Username tag */}
              {username && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#CBC0AE", padding: "6px 10px", border: LINE, borderRadius: 9 }}>
                  {username}
                </span>
              )}
              {/* Rank badge */}
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11, letterSpacing: "0.04em", color: "#15110D", background: "#CFE94B", padding: "6px 10px", borderRadius: 9 }}>
                {rank.toUpperCase()}
              </span>
              {/* Sign in — never inside MiniPay, where the wallet connects with zero clicks */}
              {!inMiniPay && (
                <button onClick={login} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, padding: "7px 13px", borderRadius: 9, background: "rgba(207,233,75,.15)", border: "1px solid rgba(207,233,75,.3)", color: "#CFE94B", cursor: "pointer" }}>
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Username setup overlay */}
        {guestView === "setup" && (
          <UsernameSetup onDone={() => setGuestView("lobby")} />
        )}

        <main style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
          <div key={guestView} className="animate-view-in"
            style={{ width: guestView === "game" ? "min(960px, 100%)" : "min(680px, 100%)", margin: "0 auto", padding: "clamp(16px,4vw,24px)" }}>
            {(guestView === "lobby" || guestView === "setup") && (
              <GuestLobby
                onPlay={(diff) => { setGuestDifficulty(diff); setGuestView("game"); }}
                lang={guestLang}
                onLangChange={setGuestLang}
              />
            )}
            {guestView === "game" && (
              <GuestBoard
                difficulty={guestDifficulty}
                lang={guestLang}
                onBack={() => setGuestView("lobby")}
                onLeaderboard={() => setGuestView("leaderboard")}
              />
            )}
            {guestView === "leaderboard" && (
              <div style={{ background: "#241C13", border: LINE, borderRadius: 18, padding: "clamp(24px,6vw,40px)", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,4vw,22px)", marginBottom: 8 }}>
                  Sign in to compete
                </div>
                <p style={{ color: "#9A8C77", fontSize: 14, lineHeight: 1.5, margin: "0 0 20px" }}>
                  The leaderboard and the weekly prize pool are for signed-in players.
                  Your guest progress stays on this device.
                </p>
                <button onClick={login} style={{ padding: "13px 26px", borderRadius: 14, border: "none", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  Sign In
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Bottom nav. Race appears only mid-round: it is a state, not a destination, and for
            guests the tab mounted GuestBoard, which opens a relayer-funded round on mount. */}
        <nav style={{ position: "sticky", bottom: 0, zIndex: 30, padding: "10px clamp(16px,4vw,24px) 14px", background: "linear-gradient(to top, #15110D 62%, transparent)" }}>
          <div style={{ width: "min(440px, 100%)", margin: "0 auto", background: "#2F2517", border: LINE2, borderRadius: 16, padding: 6, display: "flex", gap: 4 }}>
            {(["lobby", "game", "leaderboard"] as const).filter((id) => id !== "game" || guestView === "game").map((id) => {
              const active = id === "lobby"
                ? (guestView === "lobby" || guestView === "setup")
                : guestView === id;
              return (
                <button key={id} onClick={() => setGuestView(id)}
                  style={{ flex: 1, textAlign: "center", padding: 12, borderRadius: 12, cursor: "pointer", border: "none", background: active ? "#CFE94B" : "transparent", color: active ? "#15110D" : "#9A8C77", fontFamily: "var(--font-display)", fontWeight: active ? 800 : 700, fontSize: 14, transition: "background 0.15s, color 0.15s" }}>
                  {id === "lobby" ? "Lobby" : id === "game" ? "Race" : "Rankings"}
                </button>
              );
            })}
          </div>
          <LegalLinks />
        </nav>
      </div>
    );
  }

  // ── LANDING ─────────────────────────────────────────────────────────────────
  if (!isConnected) return <Landing onGuestPlay={handleGuestPlay} onConnect={login} />;

  // ── SIGN UP ─────────────────────────────────────────────────────────────────
  // Same screen a guest sees, so both flows look identical. The difference is storage:
  // a guest's name is a device cookie, a connected wallet's is saved server-side against
  // the address, so it survives reinstalls and follows the player across devices.
  // No skip here — a wallet that owns rounds on-chain should carry a name on the board.
  if (profile.needsSignUp) {
    return (
      <UsernameSetup
        allowSkip={false}
        busy={profile.saving}
        externalError={profile.error}
        subtitle={<>Pick a name to play under.<br />This is how you appear on the leaderboard.</>}
        onSubmit={profile.setUsername}
        onDone={() => setView("lobby")}
      />
    );
  }

  const isWrongChain = chainId !== celo.id;

  // ── AUTHENTICATED APP ────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-ink text-cream font-ui flex flex-col">

      <header style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(10px)", background: "rgba(21,17,13,.72)", borderBottom: LINE }}>
        <div className="flex items-center justify-between gap-3" style={{ width: "min(960px, 100%)", margin: "0 auto", padding: "0 clamp(16px,4vw,24px)", height: 58 }}>
          <button onClick={() => setView("lobby")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <Logo size="sm" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <StreakBadge />
            {(() => {
              const title = getRankTitle(points);
              return title ? (
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11, letterSpacing: "0.04em", color: "#15110D", background: "#CFE94B", padding: "6px 10px", borderRadius: 9, flexShrink: 0 }}>
                  {title.toUpperCase()}
                </span>
              ) : null;
            })()}
            <div className="hidden sm:block">
              <UsernamePrompt />
            </div>
            {!inMiniPay && (
              <button onClick={() => logout()}
                style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", padding: "5px 11px", border: LINE, borderRadius: 9, background: "none", cursor: "pointer", transition: "color 0.15s, border-color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#FF5B45"; e.currentTarget.style.borderColor = "rgba(255,91,69,.5)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6E6557"; e.currentTarget.style.borderColor = "var(--line)"; }}>
                Sign out
              </button>
            )}
          </div>
        </div>

        {isWrongChain && (
          <div style={{ background: "rgba(255,91,69,.12)", borderTop: "1px solid rgba(255,91,69,.3)", padding: "10px clamp(16px,4vw,24px)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#FF5B45" }}>⚠ Wrong network — switch to Celo mainnet to play</span>
            <button onClick={() => switchChain({ chainId: celo.id })} disabled={switching}
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#FF5B45", color: "white", cursor: switching ? "wait" : "pointer", opacity: switching ? 0.7 : 1 }}>
              {switching ? "Switching…" : "Switch to Celo"}
            </button>
          </div>
        )}
      </header>

      <main style={{ flex: 1, overflowY: "auto", paddingBottom: 90, opacity: isWrongChain ? 0.35 : 1, pointerEvents: isWrongChain ? "none" : "auto", transition: "opacity 0.2s" }}>
        <div key={view} className="animate-view-in"
          style={{ width: view === "game" ? "min(960px, 100%)" : "min(680px, 100%)", margin: "0 auto", padding: "clamp(16px,4vw,24px)" }}>
          {view === "lobby" && (
            <GameLobby onEnterGame={(id) => { setActiveRoundId(id); setView("game"); }} lang={authLang} onLangChange={setAuthLang} />
          )}
          {view === "game" && (
            <GameBoard roundId={activeRoundId} lang={authLang} onBack={() => setView("lobby")} onLeaderboard={() => setView("leaderboard")} />
          )}
          {view === "leaderboard" && <Leaderboard />}
        </div>
      </main>

      {/* Bottom nav */}
      <nav style={{ position: "sticky", bottom: 0, zIndex: 30, padding: "10px clamp(16px,4vw,24px) 14px", background: "linear-gradient(to top, #15110D 62%, transparent)" }}>
        <div style={{ width: "min(440px, 100%)", margin: "0 auto", background: "#2F2517", border: LINE2, borderRadius: 16, padding: 6, display: "flex", gap: 4 }}>
          {(["lobby", "game", "leaderboard"] as View[]).filter((id) => id !== "game" || view === "game").map((id) => (
            <button key={id} onClick={() => setView(id)}
              style={{ flex: 1, textAlign: "center", padding: 12, borderRadius: 12, cursor: "pointer", border: "none", background: view === id ? "#CFE94B" : "transparent", color: view === id ? "#15110D" : "#9A8C77", fontFamily: "var(--font-display)", fontWeight: view === id ? 800 : 700, fontSize: 14, transition: "background 0.15s, color 0.15s" }}>
              {id === "lobby" ? "Lobby" : id === "game" ? "Race" : "Rankings"}
            </button>
          ))}
        </div>
        <LegalLinks />
      </nav>
    </div>
  );
}
