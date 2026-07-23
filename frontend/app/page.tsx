"use client";
import { useState } from "react";
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
import Matchmaking from "@/components/Matchmaking";
import StreakBadge from "@/components/StreakBadge";
import UsernamePrompt from "@/components/UsernamePrompt";
import UsernameSetup from "@/components/UsernameSetup";
import { getStoredUsername, getRankTitle, getLevel, getXP, getLocalStreak } from "@/lib/player";
import type { Lang } from "@/lib/guestLetters";

type View = "lobby" | "game" | "leaderboard";
type GuestView = "setup" | "lobby" | "matchmaking" | "game" | "leaderboard";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin({ onComplete: () => { setGuestMode(false); setView("lobby"); } });
  const { logout } = useLogout({ onSuccess: () => {} });
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const isConnected = ready && authenticated;

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

  // ── GUEST MODE ──────────────────────────────────────────────────────────────
  if (!isConnected && guestMode) {
    const { count: streak, lastDate } = typeof window !== "undefined" ? getLocalStreak() : { count: 0, lastDate: "" };
    const today = typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "";
    const lastPlayedToday = lastDate === today;
    const username = typeof window !== "undefined" ? getStoredUsername() : null;
    const xp    = typeof window !== "undefined" ? getXP() : 0;
    const level = getLevel(xp);
    const rank  = getRankTitle(level);

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
              {/* Sign in */}
              <button onClick={login} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, padding: "7px 13px", borderRadius: 9, background: "rgba(207,233,75,.15)", border: "1px solid rgba(207,233,75,.3)", color: "#CFE94B", cursor: "pointer" }}>
                Sign In
              </button>
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
                onMatchmaking={() => setGuestView("matchmaking")}
                lang={guestLang}
                onLangChange={setGuestLang}
              />
            )}
            {guestView === "matchmaking" && (
              <Matchmaking
                onFound={() => { setGuestDifficulty(1); setGuestView("game"); }}
                onCancel={() => setGuestView("lobby")}
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
            {guestView === "leaderboard" && <Leaderboard isGuest />}
          </div>
        </main>

        {/* Bottom nav */}
        <nav style={{ position: "sticky", bottom: 0, zIndex: 30, padding: "10px clamp(16px,4vw,24px) 14px", background: "linear-gradient(to top, #15110D 62%, transparent)" }}>
          <div style={{ width: "min(440px, 100%)", margin: "0 auto", background: "#2F2517", border: LINE2, borderRadius: 16, padding: 6, display: "flex", gap: 4 }}>
            {(["lobby", "game", "leaderboard"] as const).map((id) => {
              const active = id === "lobby"
                ? (guestView === "lobby" || guestView === "setup" || guestView === "matchmaking")
                : guestView === id;
              return (
                <button key={id} onClick={() => setGuestView(id)}
                  style={{ flex: 1, textAlign: "center", padding: 12, borderRadius: 12, cursor: "pointer", border: "none", background: active ? "#CFE94B" : "transparent", color: active ? "#15110D" : "#9A8C77", fontFamily: "var(--font-display)", fontWeight: active ? 800 : 700, fontSize: 14, transition: "background 0.15s, color 0.15s" }}>
                  {id === "lobby" ? "Lobby" : id === "game" ? "Race" : "Rankings"}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  // ── LANDING ─────────────────────────────────────────────────────────────────
  if (!isConnected) return <Landing onGuestPlay={handleGuestPlay} onConnect={login} />;

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
              const title = typeof window !== "undefined" ? getRankTitle(getLevel(getXP())) : null;
              return title ? (
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 11, letterSpacing: "0.04em", color: "#15110D", background: "#CFE94B", padding: "6px 10px", borderRadius: 9, flexShrink: 0 }}>
                  {title.toUpperCase()}
                </span>
              ) : null;
            })()}
            <div className="hidden sm:block">
              <UsernamePrompt />
            </div>
            <button onClick={() => logout()}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", padding: "5px 11px", border: LINE, borderRadius: 9, background: "none", cursor: "pointer", transition: "color 0.15s, border-color 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#FF5B45"; e.currentTarget.style.borderColor = "rgba(255,91,69,.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#6E6557"; e.currentTarget.style.borderColor = "var(--line)"; }}>
              Sign out
            </button>
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
          {(["lobby", "game", "leaderboard"] as View[]).map((id) => (
            <button key={id} onClick={() => setView(id)}
              style={{ flex: 1, textAlign: "center", padding: 12, borderRadius: 12, cursor: "pointer", border: "none", background: view === id ? "#CFE94B" : "transparent", color: view === id ? "#15110D" : "#9A8C77", fontFamily: "var(--font-display)", fontWeight: view === id ? 800 : 700, fontSize: 14, transition: "background 0.15s, color 0.15s" }}>
              {id === "lobby" ? "Lobby" : id === "game" ? "Race" : "Rankings"}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
