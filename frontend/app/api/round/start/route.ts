import { NextRequest, NextResponse } from "next/server";
import { isAddress, decodeEventLog } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import { FEE_CURRENCY } from "@/lib/minipay";
import { publicClient, relayerWallet, signSeed, relayFees } from "@/lib/attestation";
import { getServerAttributionTag } from "@/lib/attribution";

/** startRoundFor: ~150k on mainnet. */
const START_GAS = 300_000n;

/** Opens a free round on the player's behalf. The relayer pays; the round belongs to them. */
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

    const tag = getServerAttributionTag();
    const hash = await relayerWallet().writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "startRoundFor",
      args: [player, difficulty, seed, deadline, signature],
      gas: START_GAS,
      ...(await relayFees(FEE_CURRENCY)),
      ...(tag ? { dataSuffix: tag } : {}),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") throw new Error(`startRoundFor reverted (${hash})`);

    let roundId: bigint | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== LEXIQ_ADDRESS.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: LEXIQ_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === "RoundStarted") {
          roundId = (ev.args as unknown as { roundId: bigint }).roundId;
          break;
        }
      } catch { /* not our event */ }
    }
    if (roundId === null) throw new Error("RoundStarted not found in receipt");

    return NextResponse.json({ ok: true, roundId: roundId.toString(), txHash: hash });
  } catch (err) {
    console.error("[round/start]", err);
    return NextResponse.json({ error: "Could not start round" }, { status: 500 });
  }
}
