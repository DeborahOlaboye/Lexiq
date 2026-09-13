// ERC-8021 attribution tags — https://github.com/celo-org/attribution-tags
// Tags every Celo transaction so Celo can track ecosystem impact and reward distribution.
//
// The package is ESM-only, so it must be reached with a static `import`. Loading it via
// require() builds fine but throws at runtime inside the route handler, where the error
// was swallowed and every relayed transaction silently went out untagged.
import { toDataSuffix, codeFromHostname } from "@celo/attribution-tags";
import type { Hex } from "viem";

/**
 * Canonical origin. The relayer has no `window.location`, and browser users are on this
 * host anyway, so both paths derive the same attribution code.
 */
const APP_HOSTNAME = "playlexiq.xyz";

/**
 * The code assigned to this repository by celobuilders.xyz at hackathon registration.
 *
 * Not the same value as codeFromHostname: that one is derived from the domain, this one from
 * the GitHub owner/repo slug, and the leaderboards credit only the assigned one. Both are sent
 * together — an ERC-8021 suffix carries multiple codes — so the domain code keeps working for
 * anything that already reads it.
 *
 * A tag lives in a transaction's calldata, so it counts only from the moment it ships. Nothing
 * sent before this was wired in can be credited afterwards.
 */
const ASSIGNED_CODE = "celo_a7cd3616d8b0";

const cache = new Map<string, Hex | undefined>();

function tagFor(hostname: string): Hex | undefined {
  if (!cache.has(hostname)) {
    try {
      cache.set(hostname, toDataSuffix([codeFromHostname(hostname), ASSIGNED_CODE]) as Hex);
    } catch (err) {
      // Attribution must never block a transaction — but don't hide the failure either.
      console.warn("[attribution] could not derive tag for", hostname, err);
      cache.set(hostname, undefined);
    }
  }
  return cache.get(hostname);
}

/** Browser path — writes the user signs themselves. */
export function getAttributionTag(): Hex | undefined {
  if (typeof window === "undefined") return undefined;
  return tagFor(window.location.hostname);
}

/** Server path — writes the relayer signs on a guest's behalf. */
export function getServerAttributionTag(): Hex | undefined {
  return tagFor(APP_HOSTNAME);
}
