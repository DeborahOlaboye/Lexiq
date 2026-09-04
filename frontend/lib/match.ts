import "server-only";
import { randomUUID } from "crypto";
import { keccak256, encodePacked } from "viem";
import { getRedis } from "./redis";
import type { Lang } from "./guestLetters";

/**
 * Head-to-head: two players, one board, one winner.
 *
 * Both players are issued the *same* seed, so they genuinely race the same seven letters —
 * the contract verifies whatever bytes32 the server signs, so this needs no redeploy. They
 * must also share a difficulty and a language, because the letters are derived from all three:
 * the same seed under a different language is a different board.
 *
 * Wallet players only. Guests have no standing on any board, and a match with nothing to
 * compare afterwards is the thing this replaces.
 */

const KEEP_SECONDS = 60 * 60 * 2;
/** A match whose opponent never settles resolves on its own rather than hanging forever —
 *  a dropped connection mid-round is ordinary on the networks this is played over. */
export const MATCH_TIMEOUT_SECONDS = 5 * 60;

const queueKey = (difficulty: number, lang: Lang) => `lx:mmq:${difficulty}:${lang}`;
const matchKey = (id: string) => `lx:match:${id}`;
const playerKey = (player: string) => `lx:match:of:${player.toLowerCase()}`;
const roundKey = (roundId: string) => `lx:match:round:${roundId}`;

export type MatchPlayer = { address: string; username: string; roundId?: string; score?: number };
export type Match = {
  id: string;
  seed: `0x${string}`;
  difficulty: number;
  lang: Lang;
  createdAt: number;
  players: MatchPlayer[];
};

/** One board per match, unpredictable to either player before it starts. */
function matchSeed(id: string): `0x${string}` {
  const secret = process.env.SEED_SECRET;
  if (!secret) throw new Error("SEED_SECRET not configured");
  return keccak256(encodePacked(["string", "string"], [secret, `match:${id}`]));
}

async function readMatch(kv: NonNullable<ReturnType<typeof getRedis>>, id: string): Promise<Match | null> {
  const raw = await kv.get(matchKey(id));
  return raw ? (JSON.parse(raw) as Match) : null;
}

async function writeMatch(kv: NonNullable<ReturnType<typeof getRedis>>, m: Match): Promise<void> {
  await kv.set(matchKey(m.id), JSON.stringify(m), "EX", KEEP_SECONDS);
}

/**
 * Joins the queue, pairing with anyone already waiting on the same difficulty and language.
 * Returns the match when one is made, or null while still waiting.
 */
export async function joinQueue(opts: {
  address: string; username: string; difficulty: number; lang: Lang;
}): Promise<Match | null> {
  const kv = getRedis();
  if (!kv) return null;
  const me = opts.address.toLowerCase();
  const q = queueKey(opts.difficulty, opts.lang);

  // An existing match takes precedence, so polling does not queue twice.
  const existingId = await kv.get(playerKey(me));
  if (existingId) {
    const existing = await readMatch(kv, existingId);
    if (existing) return existing;
  }

  const waiting = await kv.lrange(q, 0, -1);
  const opponentRaw = waiting.find((entry) => JSON.parse(entry).address.toLowerCase() !== me);

  if (!opponentRaw) {
    // Nobody to play. Wait, replacing any stale entry of our own.
    await kv.lrem(q, 0, JSON.stringify({ address: me, username: opts.username }));
    await kv.rpush(q, JSON.stringify({ address: me, username: opts.username }));
    await kv.expire(q, 120);
    return null;
  }

  await kv.lrem(q, 0, opponentRaw);
  const opponent = JSON.parse(opponentRaw) as { address: string; username: string };

  const id = randomUUID();
  const match: Match = {
    id,
    seed: matchSeed(id),
    difficulty: opts.difficulty,
    lang: opts.lang,
    createdAt: Date.now(),
    players: [
      { address: opponent.address.toLowerCase(), username: opponent.username },
      { address: me, username: opts.username },
    ],
  };

  await writeMatch(kv, match);
  await Promise.all(match.players.map((p) => kv.set(playerKey(p.address), id, "EX", KEEP_SECONDS)));
  return match;
}

export async function leaveQueue(address: string, difficulty: number, lang: Lang, username: string): Promise<void> {
  const kv = getRedis();
  if (!kv) return;
  await kv.lrem(queueKey(difficulty, lang), 0, JSON.stringify({ address: address.toLowerCase(), username }));
}

export async function getMatch(id: string): Promise<Match | null> {
  const kv = getRedis();
  if (!kv) return null;
  return readMatch(kv, id);
}

export async function matchForPlayer(address: string): Promise<Match | null> {
  const kv = getRedis();
  if (!kv) return null;
  const id = await kv.get(playerKey(address));
  return id ? readMatch(kv, id) : null;
}

/** Ties a round to the match, so settling it can record a score against the right game. */
export async function attachRound(matchId: string, address: string, roundId: string): Promise<void> {
  const kv = getRedis();
  if (!kv) return;
  const m = await readMatch(kv, matchId);
  if (!m) return;
  const p = m.players.find((x) => x.address === address.toLowerCase());
  if (!p) return;
  p.roundId = roundId;
  await Promise.all([writeMatch(kv, m), kv.set(roundKey(roundId), matchId, "EX", KEEP_SECONDS)]);
}

export async function matchIdForRound(roundId: string): Promise<string | null> {
  const kv = getRedis();
  if (!kv) return null;
  return kv.get(roundKey(roundId));
}

export async function recordMatchScore(roundId: string, address: string, score: number): Promise<void> {
  const kv = getRedis();
  if (!kv) return;
  const matchId = await kv.get(roundKey(roundId));
  if (!matchId) return;
  const m = await readMatch(kv, matchId);
  if (!m) return;
  const p = m.players.find((x) => x.address === address.toLowerCase());
  if (!p) return;
  p.score = score;
  await writeMatch(kv, m);
}

export type MatchOutcome = {
  state: "waiting" | "playing" | "finished";
  you?: MatchPlayer;
  opponent?: MatchPlayer;
  result?: "won" | "lost" | "drew" | "opponent-did-not-finish";
};

/**
 * Resolves a match from one player's point of view. An opponent who never settles stops
 * blocking the result once the timeout passes, rather than leaving the screen spinning.
 */
export function outcomeFor(match: Match, address: string): MatchOutcome {
  const me = match.players.find((p) => p.address === address.toLowerCase());
  const them = match.players.find((p) => p.address !== address.toLowerCase());
  if (!me || !them) return { state: "waiting" };

  if (me.score === undefined) return { state: "playing", you: me, opponent: them };

  const expired = Date.now() - match.createdAt > MATCH_TIMEOUT_SECONDS * 1000;
  if (them.score === undefined) {
    return expired
      ? { state: "finished", you: me, opponent: them, result: "opponent-did-not-finish" }
      : { state: "playing", you: me, opponent: them };
  }

  const result = me.score > them.score ? "won" : me.score < them.score ? "lost" : "drew";
  return { state: "finished", you: me, opponent: them, result };
}
