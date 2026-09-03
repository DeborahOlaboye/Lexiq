import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, LANG_ID } from "@/lib/contracts";
import { publicClient, signSeed } from "@/lib/attestation";
import { issuePlayToken } from "@/lib/playtoken";
import { missingConfig } from "@/lib/config";

/**
 * Hands a player a signed seed so they can send a staked round themselves. The seed is
 * derived from (player, nonce), so asking repeatedly returns the same draw — a player can't
 * shop for good letters and only then commit a stake.
 */
export async function POST(req: NextRequest) {
  let body: { player?: string; difficulty?: number; lang?: string };
  const missing = missingConfig();
  if (missing.length) {
    console.error("[config] missing", missing.join(", "));
    return NextResponse.json({ error: `Server not configured: ${missing.join(", ")}` }, { status: 503 });
  }

  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const player = body.player ?? "";
  if (!isAddress(player)) return NextResponse.json({ error: "Bad player" }, { status: 400 });
  const difficulty = [0, 1, 2].includes(body.difficulty ?? -1) ? body.difficulty! : 1;
  const lang = LANG_ID[body.lang ?? "en"] ?? 0;

  try {
    const nonce = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "roundNonce", args: [player],
    });
    const { seed, deadline, signature } = await signSeed(player, nonce as bigint, difficulty, lang);
    return NextResponse.json({
      seed, deadline: deadline.toString(), signature, nonce: (nonce as bigint).toString(), difficulty, lang,
      playToken: issuePlayToken(player),
    });
  } catch (err) {
    console.error("[round/seed]", err);
    return NextResponse.json({ error: "Could not issue seed" }, { status: 500 });
  }
}
