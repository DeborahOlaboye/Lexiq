import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import { publicClient, signSeed } from "@/lib/attestation";
import { issuePlayToken } from "@/lib/playtoken";

/**
 * Hands a player a signed seed so they can send a staked round themselves. The seed is
 * derived from (player, nonce), so asking repeatedly returns the same draw — a player can't
 * shop for good letters and only then commit a stake.
 */
export async function POST(req: NextRequest) {
  let body: { player?: string; difficulty?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const player = body.player ?? "";
  if (!isAddress(player)) return NextResponse.json({ error: "Bad player" }, { status: 400 });
  const difficulty = [0, 1, 2].includes(body.difficulty ?? -1) ? body.difficulty! : 1;

  try {
    const nonce = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "roundNonce", args: [player],
    });
    const { seed, deadline, signature } = await signSeed(player, nonce as bigint, difficulty);
    return NextResponse.json({
      seed, deadline: deadline.toString(), signature, nonce: (nonce as bigint).toString(), difficulty,
      playToken: issuePlayToken(player),
    });
  } catch (err) {
    console.error("[round/seed]", err);
    return NextResponse.json({ error: "Could not issue seed" }, { status: 500 });
  }
}
