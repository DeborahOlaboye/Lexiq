"use client";

/**
 * Proof that this browser is the one playing the current round, handed out when the round is
 * opened and presented again on submit. Session-scoped: it is not an identity, just a guard
 * against a stranger settling a round they merely saw on-chain.
 */
const KEY = "lx_play_token";

export function savePlayToken(token: string): void {
  try { sessionStorage.setItem(KEY, token); } catch { /* private mode */ }
}

export function getPlayToken(): string | undefined {
  try { return sessionStorage.getItem(KEY) ?? undefined; } catch { return undefined; }
}

/**
 * Whether this round is a race against the agent.
 *
 * Chosen in the lobby before the round opens, and kept here rather than passed down so it
 * survives a refresh mid-round — which routing now makes possible. The agent plays every board
 * either way, because its words come from the seed; this only decides whether the player was
 * told they were racing, and it is stored per round so the choice cannot be changed after
 * seeing a score.
 */
const VS_KEY = "lx_versus";

export function saveVersusMode(on: boolean): void {
  try { sessionStorage.setItem(VS_KEY, on ? "1" : "0"); } catch { /* private mode */ }
}

export function getVersusMode(): boolean {
  try { return sessionStorage.getItem(VS_KEY) === "1"; } catch { return false; }
}
