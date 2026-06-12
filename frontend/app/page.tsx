"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import GameLobby from "@/components/GameLobby";
import GameBoard from "@/components/GameBoard";
import Leaderboard from "@/components/Leaderboard";

type View = "lobby" | "game" | "leaderboard";

export default function Home() {
  const { isConnected, isConnecting, address } = useAccount();
  const [view, setView] = useState<View>("lobby");
  const [activeRoundId, setActiveRoundId] = useState<bigint | null>(null);

  if (isConnecting) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="text-5xl animate-spin">*</div>
      <p className="text-gray-400 text-sm">Connecting wallet...</p>
    </div>
  );

  if (!isConnected) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <h1 className="text-2xl font-bold text-violet-400">Lexiq</h1>
      <p className="text-gray-400 text-sm">Opening in MiniPay...</p>
    </div>
  );

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 pb-8">
      <header className="pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-violet-400">Lexiq</h1>
          <p className="text-xs text-gray-500">Word race · Celo</p>
        </div>
        <div className="flex items-center gap-2">
          {address && <span className="text-[10px] text-gray-600 font-mono">{address.slice(0,6)}...{address.slice(-4)}</span>}
          <button onClick={() => setView(v => v === "leaderboard" ? "lobby" : "leaderboard")}
            className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg">
            {view === "leaderboard" ? "Back" : "Rankings"}
          </button>
        </div>
      </header>
      <nav className="flex bg-gray-900 rounded-xl p-1 mb-4 gap-1">
        {([["lobby", "Lobby"], ["game", "My Round"]] as [View, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setView(id as View)}
            className={"flex-1 py-2 text-xs font-medium rounded-lg transition-colors " + (view === id ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white")}>
            {label}
            {id === "game" && activeRoundId && " #" + activeRoundId.toString()}
          </button>
        ))}
      </nav>
      {view === "lobby" && <GameLobby onEnterGame={(id) => { setActiveRoundId(id); setView("game"); }} />}
      {view === "game" && <GameBoard roundId={activeRoundId} onBack={() => setView("lobby")} />}
      {view === "leaderboard" && <Leaderboard />}
    </div>
  );
}
