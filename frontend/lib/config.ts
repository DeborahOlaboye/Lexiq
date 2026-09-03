import "server-only";

/**
 * Configuration the round endpoints need. Missing values used to surface as a generic
 * "Could not start round" the first time somebody played, which says nothing about the
 * cause — so name them explicitly instead.
 */
const REQUIRED = [
  ["GAME_SIGNER_PRIVATE_KEY", "signs score and seed attestations"],
  ["RELAYER_PRIVATE_KEY",     "sends the sponsored transactions"],
  ["SEED_SECRET",             "derives round seeds and guest addresses"],
  ["NEXT_PUBLIC_LEXIQ_ADDRESS", "contract address (must also be set at build time)"],
] as const;

export function missingConfig(): string[] {
  return REQUIRED.filter(([k]) => !process.env[k]).map(([k]) => k);
}

/** Non-secret view of configuration health, for /api/health. */
export function configReport() {
  const zero = "0x0000000000000000000000000000000000000000";
  const address = process.env.NEXT_PUBLIC_LEXIQ_ADDRESS;
  return {
    missing: missingConfig(),
    contract: address ?? null,
    // Set but pointing nowhere is worse than unset: reads succeed and return empty data.
    contractLooksValid: !!address && address !== zero && /^0x[0-9a-fA-F]{40}$/.test(address),
    redis: !!process.env.REDIS_URL,
  };
}
