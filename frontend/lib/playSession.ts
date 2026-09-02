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
