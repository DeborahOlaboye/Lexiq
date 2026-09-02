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
 * Shares the `lx:u:<playerId>` hash that /api/scores already writes, so a username set at
 * sign-up and one recorded alongside a score cannot disagree.
 */

const KEY = (addr: string) => `lx:u:${addr}`;

function normalize(raw: string | null): string | null {
  if (!raw || !isAddress(raw)) return null;
  // wagmi hands the client a checksummed address and /api/scores stores it verbatim, so
  // checksum here too — lowercasing would write to a second, divergent key.
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
    const username = await kv.hget(KEY(address), "username");
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
    await kv.hset(KEY(address), "username", username);
    return NextResponse.json({ ok: true, username });
  } catch (e) {
    console.error("/api/profile POST", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
