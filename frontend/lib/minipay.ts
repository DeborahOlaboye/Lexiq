import { celo } from "wagmi/chains";

/** Returns true when the app is running inside the MiniPay browser. */
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum?.isMiniPay;
}

// USDm (cUSD) on Celo mainnet — CIP-64 feeCurrency so gas is paid in stablecoins, not CELO.
// Same address is used directly as feeCurrency (18-decimal Mento stables use the token address, not an adapter).
export const FEE_CURRENCY = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

/**
 * Spread into writeContract() calls.
 * Enforces chainId: celo.id and pays gas in USDm via CIP-64 fee abstraction.
 * Users only need USDm — no native CELO required.
 */
export function celoFee(): { chainId: number; feeCurrency: `0x${string}` } {
  return { chainId: celo.id, feeCurrency: FEE_CURRENCY };
}

/**
 * MiniPay's Add Cash flow — send users here when their stablecoin balance
 * is too low to complete an action, instead of letting a transaction fail.
 *
 * Defaults to USDm because that is the only stablecoin Lexiq settles stakes in.
 * Offering USDC/USDT here would let a user top up and still be unable to play.
 * https://docs.minipay.xyz/technical-references/deeplinks.html
 */
export function addCashDeeplink(tokens: string = "USDm"): string {
  return `https://link.minipay.xyz/add_cash?tokens=${tokens}`;
}
