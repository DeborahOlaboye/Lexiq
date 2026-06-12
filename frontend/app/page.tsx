"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import GameLobby from "@/components/GameLobby";
import GameBoard from "@/components/GameBoard";
import Leaderboard from "@/components/Leaderboard";

type View = "lobby" | "game" | "leaderboard";

export default function Home() {
  const { isConnected, isConnecting } = useAccount();
  const [view, setView] = useState<View>("lobby");
  const [activeRoundId, setActiveRoundId] = useState<bigint | null>(null);

  if (isConnecting) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Connecting...</p>
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
      <header className="pt-5 pb-3">
        <h1 className="text-xl font-bold text-violet-400">Lexiq</h1>
      </header>
      {view === "lobby" && <GameLobby onEnterGame={(id) => { setActiveRoundId(id); setView("game"); }} />}
      {view === "game" && <GameBoard roundId={activeRoundId} onBack={() => setView("lobby")} />}
      {view === "leaderboard" && <Leaderboard />}
    </div>
  );
}
