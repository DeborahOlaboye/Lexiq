"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import Landing from "@/components/Landing";
import GameLobby from "@/components/GameLobby";
import GameBoard from "@/components/GameBoard";
import Leaderboard from "@/components/Leaderboard";

type View = "lobby" | "game" | "leaderboard";

const LINE = "1px solid var(--line)";
const LINE2 = "1px solid var(--line2)";

export default function Home() {
  const { isConnected, address } = useAccount();
  const [view, setView] = useState<View>("lobby");
  const [activeRoundId, setActiveRoundId] = useState<bigint | null>(null);

  if (!isConnected) return <Landing />;

  return (
    <div className="min-h-dvh bg-ink text-cream font-ui flex flex-col">

      {/* Sticky top nav */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 40,
          backdropFilter: "blur(10px)",
          background: "rgba(21,17,13,.72)",
          borderBottom: LINE,
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ width: "min(960px, 100%)", margin: "0 auto", padding: "0 clamp(16px,4vw,24px)", height: 58 }}
        >
          <button
            onClick={() => setView("lobby")}
            className="flex items-center gap-[10px]"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <div style={{ width: 24, height: 28, borderRadius: 5, background: "#F3ECDB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#2A2017", boxShadow: "inset 0 -2px 0 #CFC1A6" }}>L</div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#F5EFE2" }}>Lexiq</span>
          </button>
          {address && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9A8C77", padding: "5px 11px", border: LINE, borderRadius: 9 }}>
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
        <div
          key={view}
          className="animate-view-in"
          style={{
            width: view === "game" ? "min(960px, 100%)" : "min(680px, 100%)",
            margin: "0 auto",
            padding: "clamp(16px,4vw,24px)",
          }}
        >
          {view === "lobby" && (
            <GameLobby
              onEnterGame={(id) => {
                setActiveRoundId(id);
                setView("game");
              }}
            />
          )}
          {view === "game" && (
            <GameBoard
              roundId={activeRoundId}
              onBack={() => setView("lobby")}
              onLeaderboard={() => setView("leaderboard")}
            />
          )}
          {view === "leaderboard" && <Leaderboard />}
        </div>
      </main>

      {/* Bottom nav pill */}
      <nav
        style={{
          position: "sticky", bottom: 0, zIndex: 30,
          padding: "10px clamp(16px,4vw,24px) 14px",
          background: "linear-gradient(to top, #15110D 62%, transparent)",
        }}
      >
        <div
          style={{
            width: "min(440px, 100%)", margin: "0 auto",
            background: "#2F2517",
            border: LINE2,
            borderRadius: 16, padding: 6,
            display: "flex", gap: 4,
          }}
        >
          {(["lobby", "game", "leaderboard"] as View[]).map((id) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                flex: 1, textAlign: "center", padding: 12,
                borderRadius: 12, cursor: "pointer", border: "none",
                background: view === id ? "#CFE94B" : "transparent",
                color: view === id ? "#15110D" : "#9A8C77",
                fontFamily: "var(--font-display)",
                fontWeight: view === id ? 800 : 700,
                fontSize: 14,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {id === "lobby" ? "Lobby" : id === "game" ? "Race" : "Rankings"}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
