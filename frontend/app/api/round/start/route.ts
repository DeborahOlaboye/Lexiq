import { NextRequest, NextResponse } from "next/server";
import { isAddress, decodeEventLog } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, LANG_ID } from "@/lib/contracts";
import { publicClient, relayerWallet, signSeed, relayFees } from "@/lib/attestation";
import { guestAddress, issuePlayToken } from "@/lib/playtoken";
import { getServerAttributionTag } from "@/lib/attribution";

/** startRoundFor: ~150k on mainnet. */
const START_GAS = 300_000n;

/**
 * Opens a free round and returns the letters it drew. Used by signed-in players and guests
 * alike — a guest plays under an address derived from their browser id, so their rounds are
 * real on-chain rounds with real letters rather than a client-side approximation.
 */
export async function POST(req: NextRequest) {
  let body: { player?: string; guestId?: string; difficulty?: number; lang?: string; challengeRoundId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const difficulty = [0, 1, 2].includes(body.difficulty ?? -1) ? body.difficulty! : 1;
  const lang = LANG_ID[body.lang ?? "en"] ?? 0;

  let player: `0x${string}`;
  if (body.player && isAddress(body.player)) {
    player = body.player;
  } else if (body.guestId) {
    player = guestAddress(body.guestId);
  } else {
    return NextResponse.json({ error: "Bad player" }, { status: 400 });
  }

  try {
    const tag = getServerAttributionTag();
    const fees = { gas: START_GAS, ...(await relayFees()), ...(tag ? { dataSuffix: tag } : {}) };

    // A challenge inherits the original round's seed, difficulty and language, so it needs no
    // seed attestation. Free ones are relayed like any other free round; staked ones are sent
    // by the player, since the relayer must never move their tokens.
    const hash = body.challengeRoundId
      ? await relayerWallet().writeContract({
          address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "startChallengeFor",
          args: [player, BigInt(body.challengeRoundId)], ...fees,
        })
      : await (async () => {
          const nonce = await publicClient.readContract({
            address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "roundNonce", args: [player],
          });
          const { seed, deadline, signature } = await signSeed(player, nonce as bigint, difficulty, lang);
          return relayerWallet().writeContract({
            address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "startRoundFor",
            args: [player, difficulty, lang, seed, deadline, signature], ...fees,
          });
        })();

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") throw new Error(`round did not open (${hash})`);

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

    const rawLetters = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getLetters", args: [roundId],
    }) as readonly `0x${string}`[];
    const letters = rawLetters.map((b) => String.fromCharCode(parseInt(b.slice(2), 16))).join("");

    return NextResponse.json({
      ok: true,
      roundId: roundId.toString(),
      letters,
      player,
      playToken: issuePlayToken(player),
      txHash: hash,
    });
  } catch (err) {
    console.error("[round/start]", err);
    return NextResponse.json({ error: "Could not start round" }, { status: 500 });
  }
}
