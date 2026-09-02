// ERC-8021 attribution tags — https://github.com/celo-org/attribution-tags
// Tags every Celo transaction so Celo can track ecosystem impact and reward distribution.
// Guard is required: codeFromHostname uses window.location which is browser-only.
import type { Hex } from "viem";

let _cached: Hex | null = null;

export function getAttributionTag(): Hex | undefined {
  if (typeof window === "undefined") return undefined;
  if (_cached) return _cached;
  try {
    const { toDataSuffix, codeFromHostname } = require("@celo/attribution-tags");
    _cached = toDataSuffix(codeFromHostname(window.location.hostname)) as Hex;
    return _cached;
  } catch {
    return undefined;
  }
}

/** Canonical origin, used to derive the same attribution code the browser produces. */
const APP_HOSTNAME = "playlexiq.xyz";

let _serverCached: Hex | null = null;

/**
 * Server-side equivalent of {@link getAttributionTag}, for transactions the relayer
 * signs on a guest's behalf. There is no `window.location` in a route handler, so the
 * canonical hostname is used directly — guest rounds are the bulk of on-chain volume
 * and would otherwise go entirely untracked.
 */
export function getServerAttributionTag(): Hex | undefined {
  if (_serverCached) return _serverCached;
  try {
    const { toDataSuffix, codeFromHostname } = require("@celo/attribution-tags");
    _serverCached = toDataSuffix(codeFromHostname(APP_HOSTNAME)) as Hex;
    return _serverCached;
  } catch {
    return undefined;
  }
}
