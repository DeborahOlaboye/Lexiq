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
