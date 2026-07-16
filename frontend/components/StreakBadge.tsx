"use client";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { usePlayerStreak } from "@/hooks/usePlayerStreak";

export default function StreakBadge() {
  const { address } = useAccount();
  const { streak, lastPlayedToday } = usePlayerStreak(address ?? undefined);
  if (streak === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.2, 1.6, 0.4, 1] as [number,number,number,number] }}
      title={`${streak}-day streak${lastPlayedToday ? " · played today ✓" : " · play today to keep it!"}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 9, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, cursor: "default", userSelect: "none",
        background: lastPlayedToday ? "rgba(207,233,75,.14)" : "rgba(255,91,69,.12)",
        border: lastPlayedToday ? "1px solid rgba(207,233,75,.4)" : "1px solid rgba(255,91,69,.4)",
        color: lastPlayedToday ? "#CFE94B" : "#FF5B45",
      }}
    >
      <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>🔥</motion.span>
      {streak}
    </motion.div>
  );
}
