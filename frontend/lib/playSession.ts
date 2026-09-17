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

/**
 * The words typed so far in the round being played.
 *
 * Round state used to live only in the board component, so anything that unmounted it threw
 * the player's words away: navigating, a refresh, or — the one that actually hurts — a
 * backgrounded tab being reclaimed by the phone, which is routine on the low-end Android this
 * game is built for. Everything else about a round recovers on its own (the timer is derived
 * from the round's on-chain start, the letters and the opponent are refetched); this was the
 * only part that existed nowhere else.
 *
 * localStorage rather than sessionStorage, because a killed tab is exactly the case worth
 * surviving. Keyed by round so a restored list can never be attached to a different board,
 * and only the current round is kept.
 */
const WORDS_PREFIX = "lx_words_";

export type StoredWord = { word: string; salt: `0x${string}`; pts: number };

export function saveRoundWords(roundId: string, words: StoredWord[]): void {
  try {
    // One round at a time: a finished round's list is dead weight and must never be restored.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(WORDS_PREFIX) && k !== WORDS_PREFIX + roundId) localStorage.removeItem(k);
    }
    localStorage.setItem(WORDS_PREFIX + roundId, JSON.stringify(words));
  } catch { /* private mode, or the quota is full — the round still plays */ }
}

export function getRoundWords(roundId: string): StoredWord[] {
  try {
    const raw = localStorage.getItem(WORDS_PREFIX + roundId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredWord[]) : [];
  } catch { return []; }
}

export function clearRoundWords(roundId: string): void {
  try { localStorage.removeItem(WORDS_PREFIX + roundId); } catch { /* nothing to do */ }
}
