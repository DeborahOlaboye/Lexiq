"use client";
import { useAccount, useReadContract } from "wagmi";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import { getXP } from "@/lib/player";

/**
 * Cumulative lifetime points, the input to level and rank.
 *
 * Wallet players read the contract's `totalScore`: it survives reinstalls and device changes,
 * and can't be edited from devtools. Guests fall back to the local cookie.
 */
export function usePlayerPoints(): number {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "totalScore",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (address) return data ? Number(data) : 0;
  return typeof window !== "undefined" ? getXP() : 0;
}
