/** Returns true when the app is running inside the MiniPay browser. */
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum?.isMiniPay;
}

// cUSD on Celo mainnet — supported as a feeCurrency for gas abstraction
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

/**
 * Spread into writeContract() calls.
 * Inside MiniPay this adds feeCurrency so gas is paid in cUSD instead of CELO,
 * which matches MiniPay users who may hold no native CELO.
 */
export function celoFee(): { feeCurrency?: `0x${string}` } {
  return isMiniPay() ? { feeCurrency: CUSD } : {};
}
