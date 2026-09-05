import { NextRequest, NextResponse } from "next/server";
import { isAddress, decodeEventLog } from "viem";
import { LEXIQ_ADDRESS, LEXIQ_ABI, LANG_ID, ROUND } from "@/lib/contracts";
import { publicClient, relayerWallet, signSeed, relayFees, lettersForRound } from "@/lib/attestation";
import { guestAddress, issuePlayToken } from "@/lib/playtoken";
import { solveBoard } from "@/lib/wordlist";
import { hashAll } from "@/lib/wordhash";
import { LANG_BY_ID } from "@/lib/contracts";
import { getServerAttributionTag } from "@/lib/attribution";
import { missingConfig } from "@/lib/config";
import { todayKey, dailyDifficulty, claimTodaysAttempt, markRoundAsDaily } from "@/lib/daily";
import { checkRelayBudget, denied } from "@/lib/ratelimit";

const ROUND_SECONDS: Record<number, number> = { 0: 120, 1: 90, 2: 60 };

/** startRoundFor: ~150k on mainnet. */
const START_GAS = 300_000n;

/**
 * Opens a free round and returns the letters it drew. Used by signed-in players and guests
 * alike — a guest plays under an address derived from their browser id, so their rounds are
 * real on-chain rounds with real letters rather than a client-side approximation.
 */
export async function POST(req: NextRequest) {
  let body: { player?: string; guestId?: string; difficulty?: number; lang?: string; challengeRoundId?: string; daily?: boolean };
  const missing = missingConfig();
  if (missing.length) {
    console.error("[config] missing", missing.join(", "));
    return NextResponse.json({ error: `Server not configured: ${missing.join(", ")}` }, { status: 503 });
  }

  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const today = todayKey();
  // The daily runs at one difficulty for everybody, so the length of the round is not
  // something a player can pick to flatter their own score.
  const difficulty = body.daily
    ? dailyDifficulty(today)
    : ([0, 1, 2].includes(body.difficulty ?? -1) ? body.difficulty! : 1);
  const lang = LANG_ID[body.lang ?? "en"] ?? 0;

  let player: `0x${string}`;
  let isGuest = false;
  if (body.player && isAddress(body.player)) {
    player = body.player;
  } else if (body.guestId) {
    player = guestAddress(body.guestId);
    isGuest = true;
  } else {
    return NextResponse.json({ error: "Bad player" }, { status: 400 });
  }

  // Checked before the daily is claimed below, so a refused round never costs a player their
  // one attempt at today's challenge.
  const denial = await checkRelayBudget({ req, player, isGuest });
  if (denial) return denied(denial);

  // Claimed before the round opens, not when it settles: claiming at the end would let a
  // player open the daily, dislike the draw, walk away and try again — the same re-roll the
  // seed attestation exists to prevent.
  if (body.daily && !(await claimTodaysAttempt(player, today))) {
    return NextResponse.json({ error: "You have already played today's challenge" }, { status: 409 });
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

    const letters = await lettersForRound(roundId, player);

    // The client counts down against this rather than its own start moment, so its clock
    // agrees with the deadline the server enforces at settlement.
    const round = await publicClient.readContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getRound", args: [roundId],
    }) as readonly unknown[];
    const startedAt = Number(round[ROUND.startedAt]);
    const seconds = ROUND_SECONDS[difficulty] ?? 90;

    // Hashes, not words: the client can check a guess instantly and offline, without being
    // handed a readable answer key.
    const wordHashes = hashAll(solveBoard(letters, LANG_BY_ID[lang] ?? "en").map((w) => w.word));

    if (body.daily) await markRoundAsDaily(roundId.toString(), today);

    return NextResponse.json({
      ok: true,
      roundId: roundId.toString(),
      letters,
      wordHashes,
      daily: !!body.daily,
      difficulty,
      startedAt,
      seconds,
      player,
      playToken: issuePlayToken(player),
      txHash: hash,
    });
  } catch (err) {
    console.error("[round/start]", err);
    return NextResponse.json({ error: "Could not start round" }, { status: 500 });
  }
}
