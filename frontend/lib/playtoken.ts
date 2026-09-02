import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { keccak256, toBytes, getAddress } from "viem";
import { nowSeconds } from "./attestation";

function secret(): string {
  const s = process.env.SEED_SECRET;
  if (!s) throw new Error("SEED_SECRET not configured");
  return s;
}

/**
 * A stable on-chain identity for a guest, derived from their browser id.
 *
 * Nobody holds the key, and nothing ever needs to sign for it: guests never stake and the
 * relayer opens their rounds. It exists so guest play attributes to a per-guest address
 * instead of piling every guest round onto the relayer's own stats.
 */
export function guestAddress(guestId: string): `0x${string}` {
  const h = keccak256(toBytes(`lexiq-guest:${secret()}:${guestId}`));
  return getAddress(`0x${h.slice(-40)}`);
}

/**
 * Proof that the caller is the one playing a round.
 *
 * Without this, submitting is open to anyone who can read a roundId — and RoundStarted is a
 * public event, so an attacker could watch for a staked round and immediately settle it with
 * no words, forfeiting someone else's stake. The token is issued when a round is opened (or
 * a seed is handed out) and bound to the player it was issued for.
 *
 * HMAC rather than a stored token so this keeps working when Redis is unavailable.
 */
export function issuePlayToken(player: string, ttlSeconds = 3600): string {
  const exp = nowSeconds() + ttlSeconds;
  return `${exp}.${sign(player, exp)}`;
}

export function verifyPlayToken(token: string | undefined, player: string): boolean {
  if (!token) return false;
  const [expStr, provided] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < nowSeconds()) return false;

  const expected = sign(player, exp);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(player: string, exp: number): string {
  return createHmac("sha256", secret())
    .update(`${player.toLowerCase()}:${exp}`)
    .digest("hex")
    .slice(0, 32);
}
