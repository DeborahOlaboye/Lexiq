"use client";
import { useState } from "react";
import { useAccount, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import { motion } from "framer-motion";
import Landing from "@/components/Landing";
import GameLobby from "@/components/GameLobby";
import GameBoard from "@/components/GameBoard";
import GuestBoard from "@/components/GuestBoard";
import GuestLobby from "@/components/GuestLobby";
import Leaderboard from "@/components/Leaderboard";
import StreakBadge from "@/components/StreakBadge";
import UsernamePrompt from "@/components/UsernamePrompt";
import UsernameSetup from "@/components/UsernameSetup";
import { getStoredUsername, getRankTitle, getLevel, getXP } from "@/lib/player";

type View = "lobby" | "game" | "leaderboard";

const LINE  = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

export default function Home() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [view, setView] = useState<View>("lobby");
  const [activeRoundId, setActiveRoundId] = useState<bigint | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [guestView, setGuestView] = useState<"setup" | "lobby" | "game" | "leaderboard">("lobby");
  const [guestDifficulty, setGuestDifficulty] = useState<0|1|2>(1);

  function handleGuestPlay() {
    setGuestMode(true);
    if (!getStoredUsername()) {
      setGuestView("setup");
    } else {
      setGuestView("lobby");
    }
  }

  // Guest mode — full app shell, no wallet required
  if (!isConnected && guestMode) {
    return (
      <div className="min-h-dvh bg-ink text-cream font-ui flex flex-col">
        <header style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(10px)", background: "rgba(21,17,13,.72)", borderBottom: LINE }}>
          <div className="flex items-center justify-between gap-3" style={{ width: "min(960px, 100%)", margin: "0 auto", padding: "0 clamp(16px,4vw,24px)", height: 58 }}>
            <button onClick={() => setGuestView("lobby")} className="flex items-center gap-[10px]" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.0, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 24, height: 28, borderRadius: 5, background: "#F3ECDB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#2A2017", boxShadow: "inset 0 -2px 0 #CFC1A6" }}>L</motion.div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#F5EFE2" }}>Lexiq</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block"><UsernamePrompt /></div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", padding: "4px 10px", border: LINE, borderRadius: 8 }}>Guest</span>
              <button onClick={() => setGuestMode(false)} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", padding: "5px 11px", border: LINE, borderRadius: 9, background: "none", cursor: "pointer" }}>
                Connect wallet
              </button>
            </div>
          </div>
        </header>

        {guestView === "setup" && (
          <UsernameSetup onDone={() => setGuestView("lobby")} />
        )}

        <main style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
          <div key={guestView} className="animate-view-in"
            style={{ width: guestView === "game" ? "min(960px, 100%)" : "min(680px, 100%)", margin: "0 auto", padding: "clamp(16px,4vw,24px)" }}>
            {(guestView === "lobby" || guestView === "setup") && (
              <GuestLobby onPlay={(diff) => { setGuestDifficulty(diff); setGuestView("game"); }} />
            )}
            {guestView === "game" && (
              <GuestBoard
                difficulty={guestDifficulty}
                onBack={() => setGuestView("lobby")}
                onLeaderboard={() => setGuestView("leaderboard")}
              />
            )}
            {guestView === "leaderboard" && <Leaderboard isGuest />}
          </div>
        </main>

        <nav style={{ position: "sticky", bottom: 0, zIndex: 30, padding: "10px clamp(16px,4vw,24px) 14px", background: "linear-gradient(to top, #15110D 62%, transparent)" }}>
          <div style={{ width: "min(440px, 100%)", margin: "0 auto", background: "#2F2517", border: LINE2, borderRadius: 16, padding: 6, display: "flex", gap: 4 }}>
            {(["lobby", "game", "leaderboard"] as const).map((id) => {
              const active = id === "lobby" ? (guestView === "lobby" || guestView === "setup") : guestView === id;
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

  // Not connected (and not in guest mode) → landing
  if (!isConnected) return <Landing onGuestPlay={handleGuestPlay} />;

  const isWrongChain = chainId !== celo.id;

  return (
    <div className="min-h-dvh bg-ink text-cream font-ui flex flex-col">

      {/* Sticky top nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(10px)", background: "rgba(21,17,13,.72)", borderBottom: LINE }}>
        <div className="flex items-center justify-between gap-3" style={{ width: "min(960px, 100%)", margin: "0 auto", padding: "0 clamp(16px,4vw,24px)", height: 58 }}>
          <button onClick={() => setView("lobby")} className="flex items-center gap-[10px] shrink-0" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.0, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 24, height: 28, borderRadius: 5, background: "#F3ECDB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#2A2017", boxShadow: "inset 0 -2px 0 #CFC1A6" }}>L</motion.div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#F5EFE2" }}>Lexiq</span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <StreakBadge />
            {(() => {
              const title = typeof window !== "undefined" ? getRankTitle(getLevel(getXP())) : null;
              return title ? (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#CFE94B", padding: "3px 9px", borderRadius: 7, border: "1px solid rgba(207,233,75,.3)", background: "rgba(207,233,75,.08)", flexShrink: 0 }}>
                  {title}
                </span>
              ) : null;
            })()}
            <div className="hidden sm:block">
              <UsernamePrompt />
            </div>
            <button onClick={() => disconnect()}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6E6557", padding: "5px 11px", border: LINE, borderRadius: 9, background: "none", cursor: "pointer", transition: "color 0.15s, border-color 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#FF5B45"; e.currentTarget.style.borderColor = "rgba(255,91,69,.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#6E6557"; e.currentTarget.style.borderColor = "var(--line)"; }}>
              Disconnect
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
            <GameLobby onEnterGame={(id) => { setActiveRoundId(id); setView("game"); }} />
          )}
          {view === "game" && (
            <GameBoard roundId={activeRoundId} onBack={() => setView("lobby")} onLeaderboard={() => setView("leaderboard")} />
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
