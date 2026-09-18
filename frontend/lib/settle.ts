import "server-only";
import { LEXIQ_ADDRESS, LEXIQ_ABI, ROUND, ROUND_ACTIVE, LANG_BY_ID } from "./contracts";
import { publicClient, signScore, nowSeconds, lettersForRound } from "./attestation";
import { verifyPlayToken } from "./playtoken";
import { acceptWords, boardMaxScore } from "./wordlist";
import { scoreWords, MAX_WORDS } from "./scoring";
import type { Lang } from "./guestLetters";
import { opponentPlay, LEVEL_NAMES, type OpponentPlay } from "./opponent";
import { readVersusLevel } from "./versusRound";

/**
 * Slack on top of the round length, for everything that happens between the buzzer and the
 * submission landing: reading the board, tapping submit, a wallet confirmation, a slow request.
 *
 * Generous on purpose. It buys almost no protection — the letters are public on-chain from the
 * moment a round opens, so anyone set on solving offline can do it in a second — while a tight
 * window silently destroys the round of an honest player who paused before submitting.
 */
const GRACE_SECONDS = 5 * 60;
const DURATION: Record<number, number> = { 0: 120, 1: 90, 2: 60 };

export type SettleFailure = { ok: false; status: number; error: string };
export type SettleResult = {
  ok: true;
  player: `0x${string}`;
  lang: Lang;
  letters: string;
  seed: string;
  words: string[];
  score: number;
  maxScore: number;
  percent: number;
  deadline: bigint;
  signature: `0x${string}`;
  /** What the agent scored on the same board, for the head-to-head. */
  agent: OpponentPlay & { name: string };
};

/**
 * Validates a submission and signs the score for it. Writes nothing to the chain.
 *
 * Shared by the relayed path and the path where a MiniPay player sends the transaction
 * themselves — the two differ only in who pays, and what a round is worth must not be able to
 * drift between them.
 */
export async function scoreSubmission(
  roundId: bigint, submitted: string[], playToken: string | undefined,
): Promise<SettleResult | SettleFailure> {
  const round = await publicClient.readContract({
    address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "getRound", args: [roundId],
  }) as readonly unknown[];

  const player     = round[ROUND.player] as `0x${string}`;
  const startedAt  = Number(round[ROUND.startedAt]);
  const difficulty = Number(round[ROUND.difficulty]);
  const state      = Number(round[ROUND.state]);
  // Read from the round, never the request: a player could otherwise open a round on the
  // French table — heavily weighted to E — and settle it against the English dictionary.
  const lang: Lang = LANG_BY_ID[Number(round[ROUND.lang])] ?? "en";

  if (state !== ROUND_ACTIVE) {
    return { ok: false, status: 409, error: "Round already finished" };
  }
  // RoundStarted is a public event, so without this anyone watching the chain could settle a
  // stranger's active round with no words and forfeit their stake.
  if (!verifyPlayToken(playToken, player)) {
    return { ok: false, status: 403, error: "Not your round" };
  }
  if (nowSeconds() - startedAt > (DURATION[difficulty] ?? 90) + GRACE_SECONDS) {
    return { ok: false, status: 410, error: "This round timed out before it could be saved. Your next one will save fine." };
  }

  const letters  = await lettersForRound(roundId, player);
  const words    = acceptWords(submitted, letters, lang, MAX_WORDS);
  const score    = scoreWords(words);
  const maxScore = boardMaxScore(letters, lang);
  const percent  = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;

  const { deadline, signature } = await signScore(roundId, player, score, words.length);
  const seed = String(round[ROUND.seed]);

  /**
   * The agent played the same board. Its level follows the round's difficulty, which the
   * contract recorded when the round opened — so the opposition was fixed before the player
   * saw a letter, and nobody can pick an easier opponent once they know their own score.
   *
   * Computed here rather than stored anywhere: it is a pure function of the seed, so it is the
   * same answer every time and anyone can recompute it from public round data.
   */
  // Whatever opponent this board was loaded against, so the final result matches the one the
  // player watched climbing during the round rather than quietly reverting to the difficulty.
  const level = await readVersusLevel(roundId.toString(), difficulty);
  const play = opponentPlay({ seed, letters, lang, level });
  const agent = { ...play, name: LEVEL_NAMES[play.level] ?? "Sharp" };

  return { ok: true, player, lang, letters, seed, words, score, maxScore, percent, deadline, signature, agent };
}
