import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { getRedis } from "@/lib/redis";

/**
 * Wallet-keyed player profile.
 *
 * Guests keep their name in a cookie, which is per-device — a reinstall loses it. A
 * connected wallet is a stable identity, so its name is stored server-side and follows the
 * player across devices and reinstalls.
 *
 * Writes the same hashes the boards read, because they are the whole point of setting a name.
 *
 * This used to write `lx:u:<Checksummed>`, matching neither reader: the all-time board reads
 * `lx:u:v2:<lowercase>` and the weekly board reads `lx:u:<lowercase>`. A player renaming
 * themselves saved to a key nothing read, so every board kept showing whatever name was
 * attached to their last score. Both are written now, and both lowercased — an address is
 * case-insensitive, so the casing a wallet hands us must never decide where a name lands.
 */

/** Read by /api/scores for the all-time board. */
const KEY_V2 = (addr: string) => `lx:u:v2:${addr.toLowerCase()}`;
/** Read by lib/weekly.ts for the weekly board. */
const KEY_WEEKLY = (addr: string) => `lx:u:${addr.toLowerCase()}`;
/** Where names were written before this was fixed, so existing ones are not orphaned. */
const KEY_LEGACY = (addr: string) => `lx:u:${addr}`;

function normalize(raw: string | null): string | null {
  if (!raw || !isAddress(raw)) return null;
  // Checksummed only so KEY_LEGACY can still find pre-fix names; every write lowercases.
  return getAddress(raw);
}

/** Same rules the sign-up input enforces, applied again server-side. */
function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
  return name.length >= 2 ? name : null;
}

// GET /api/profile?address=0x…  ->  { username: string | null }
export async function GET(req: NextRequest) {
  const address = normalize(req.nextUrl.searchParams.get("address"));
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  try {
    const kv = getRedis();
    if (!kv) return NextResponse.json({ username: null });
    // v2 first, then the weekly key, then the pre-fix one — so a name saved under the old
    // scheme still resolves instead of the player appearing to have lost it.
    const username =
      (await kv.hget(KEY_V2(address), "username")) ??
      (await kv.hget(KEY_WEEKLY(address), "username")) ??
      (await kv.hget(KEY_LEGACY(address), "username"));
    return NextResponse.json({ username: username ?? null });
  } catch (e) {
    console.error("/api/profile GET", e);
    // Fall back to "no profile" rather than erroring — the client can still use its cookie.
    return NextResponse.json({ username: null });
  }
}

// POST /api/profile  { address, username }  ->  { ok, username }
export async function POST(req: NextRequest) {
  let body: { address?: string; username?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const address = normalize(body.address ?? null);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const username = cleanUsername(body.username);
  if (!username) return NextResponse.json({ error: "Username must be 2-16 letters, numbers or underscores" }, { status: 400 });

  try {
    const kv = getRedis();
    if (!kv) return NextResponse.json({ error: "Profile unavailable" }, { status: 503 });
    // Both boards, in one go: a rename that only reached one of them is the bug this fixes.
    await Promise.all([
      kv.hset(KEY_V2(address), "username", username),
      kv.hset(KEY_WEEKLY(address), "username", username),
    ]);
    return NextResponse.json({ ok: true, username });
  } catch (e) {
    console.error("/api/profile POST", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
