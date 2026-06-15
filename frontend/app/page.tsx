"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import Landing from "@/components/Landing";
import GameLobby from "@/components/GameLobby";
import GameBoard from "@/components/GameBoard";
import Leaderboard from "@/components/Leaderboard";

type View = "lobby" | "game" | "leaderboard";

export default function Home() {
  const { isConnected, isConnecting, address } = useAccount();
  const [view, setView] = useState<View>("lobby");
  const [activeRoundId, setActiveRoundId] = useState<bigint | null>(null);

  if (!isConnected) return <Landing isConnecting={isConnecting} />;

  return (
    <div className="min-h-screen bg-ink flex flex-col" style={{ maxWidth: 390, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-[18px] py-4">
        <div className="flex items-center gap-2">
          <div
            className="w-[22px] h-[26px] rounded-[5px] bg-tile flex items-center justify-center font-display font-extrabold text-[15px] text-tileink"
            style={{ boxShadow: "inset 0 -2px 0 #CFC1A6" }}
          >
            L
          </div>
          <span className="font-display font-extrabold text-[18px] text-cream">Lexiq</span>
        </div>
        {address && (
          <span
            className="font-mono text-[10px] text-muted px-2 py-[5px] rounded-lg"
            style={{ border: "1px solid var(--line)" }}
          >
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-[18px]" style={{ paddingBottom: 80 }}>
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
      </main>

      {/* Bottom nav */}
      <div
        className="fixed bottom-0 flex gap-1.5 px-3.5 pb-4 pt-2.5"
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(390px, 100vw)",
          background: "linear-gradient(to top, #15110D 70%, transparent)",
        }}
      >
        {(
          [
            ["lobby", "Lobby"],
            ["game", "Race"],
            ["leaderboard", "Rankings"],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex-1 py-[11px] rounded-[13px] font-display font-bold text-[13px] transition-colors ${
              view === id ? "bg-lime text-ink" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
