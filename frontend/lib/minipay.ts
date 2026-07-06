import { celo } from "wagmi/chains";

/** Returns true when the app is running inside the MiniPay browser. */
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum?.isMiniPay;
}

// cUSD on Celo mainnet — supported as a feeCurrency for gas abstraction
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

/**
 * Spread into writeContract() calls.
 * Always enforces chainId: celo.id so MetaMask/wallets prompt a chain
 * switch instead of sending the tx on whatever network they're on.
 * Inside MiniPay also adds feeCurrency so gas is paid in cUSD.
 */
export function celoFee(): { chainId: number; feeCurrency?: `0x${string}` } {
  return isMiniPay()
    ? { chainId: celo.id, feeCurrency: CUSD }
    : { chainId: celo.id };
}
