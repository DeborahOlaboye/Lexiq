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
  const trimmed = name.trim().slice(0, 16).replace(/[^a-zA-Z0-9_]/g, "");
  if (trimmed) setCookie("lx_username", trimmed, 365);
}

export function displayName(address?: string): string {
  const u = getStoredUsername();
  if (u) return u;
  if (address) return address.slice(0, 6) + "…" + address.slice(-4);
  return "Anonymous";
}

// ── Streak (cookie-based, instant — no KV race) ────────────────────────────

type StreakData = { count: number; lastDate: string; longest: number };

export function getLocalStreak(): StreakData {
  try {
    const raw = getCookie("lx_streak");
    if (!raw) return { count: 0, lastDate: "", longest: 0 };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { count: 0, lastDate: "", longest: 0 };
  }
}

export function recordPlay(): StreakData {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const { count, lastDate, longest } = getLocalStreak();

  if (lastDate === today) return { count, lastDate, longest }; // already recorded today

  const newCount   = lastDate === yesterday ? count + 1 : 1;
  const newLongest = Math.max(longest, newCount);
  const data: StreakData = { count: newCount, lastDate: today, longest: newLongest };
  setCookie("lx_streak", JSON.stringify(data), 365);
  return data;
}

// ── XP / Level / Rank ───────────────────────────────────────────────────────

export function getXP(): number {
  return parseInt(getCookie("lx_xp") || "0", 10) || 0;
}

export function addXP(pts: number): number {
  const next = getXP() + pts;
  setCookie("lx_xp", String(next), 365);
  return next;
}

export function getLevel(xp?: number): number {
  return Math.floor((xp ?? getXP()) / 60) + 1;
}

const TITLES = [
  { minLevel: 7, name: "Legend"   },
  { minLevel: 5, name: "Ultimate" },
  { minLevel: 4, name: "Master"   },
  { minLevel: 3, name: "Ace"      },
  { minLevel: 2, name: "Wordsmith"},
  { minLevel: 1, name: "Rookie"   },
];

export function getRankTitle(level?: number): string {
  const lv = level ?? getLevel();
  return TITLES.find(t => t.minLevel <= lv)?.name ?? "Rookie";
}

// ── Tile skins ───────────────────────────────────────────────────────────────

export type Skin = { id: string; name: string; minLevel: number; bg: string; ink: string; edge: string };

export const SKINS: Skin[] = [
  { id: "classic", name: "Classic", minLevel: 1, bg: "#F3ECDB", ink: "#2A2017", edge: "#CFC1A6" },
  { id: "coral",   name: "Coral",   minLevel: 2, bg: "#FF5B45", ink: "#fff",    edge: "#E2402A" },
  { id: "slate",   name: "Slate",   minLevel: 3, bg: "#2A2F3A", ink: "#EDEFF3", edge: "#151922" },
  { id: "gold",    name: "Gold",    minLevel: 5, bg: "#F4C84B", ink: "#3c2e05", edge: "#C9992C" },
];

export function getSelectedSkin(): Skin {
  const id = getCookie("lx_skin") || "classic";
  return SKINS.find(s => s.id === id) ?? SKINS[0];
}

export function saveSkin(id: string): void {
  setCookie("lx_skin", id, 365);
}

// ── Badges ───────────────────────────────────────────────────────────────────

export const ALL_BADGES = [
  { id: "jackpot",  name: "Bomb Finder",    desc: "Find a 7-letter word"       },
  { id: "onfire",   name: "On Fire",        desc: "Hit a ×3 combo"             },
  { id: "century",  name: "Century Club",   desc: "Score 100+ lifetime XP"     },
  { id: "top10",    name: "Weekly Top 10",  desc: "Finish top 10 this week"    },
];

export function getBadges(): string[] {
  try { return JSON.parse(getCookie("lx_badges") || "[]") as string[]; }
  catch { return []; }
}

export function awardBadge(id: string): boolean {
  const list = getBadges();
  if (list.includes(id)) return false;
  list.push(id);
  setCookie("lx_badges", JSON.stringify(list), 365);
  return true;
}
