"use client";

// ── Cookie helpers ──────────────────────────────────────────────────────────

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

// ── Guest identity ──────────────────────────────────────────────────────────

/** Returns a stable UUID for the current browser session (guest identity). */
export function getGuestId(): string {
  let id = getCookie("lx_uid");
  if (!id) {
    id = crypto.randomUUID();
    setCookie("lx_uid", id, 365);
  }
  return id;
}

// ── Username ────────────────────────────────────────────────────────────────

export function getStoredUsername(): string | null {
  return getCookie("lx_username");
}

export function saveUsername(name: string): void {
  const trimmed = name.trim().slice(0, 20);
  if (trimmed) setCookie("lx_username", trimmed, 365);
}

/** Returns the best display name for a playerId / address. */
export function displayName(address?: string): string {
  const u = getStoredUsername();
  if (u) return u;
  if (address) return address.slice(0, 6) + "…" + address.slice(-4);
  return "Anonymous";
}
