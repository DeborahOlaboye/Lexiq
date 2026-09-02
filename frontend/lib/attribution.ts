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

const cache = new Map<string, Hex | undefined>();

function tagFor(hostname: string): Hex | undefined {
  if (!cache.has(hostname)) {
    try {
      cache.set(hostname, toDataSuffix(codeFromHostname(hostname)) as Hex);
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
