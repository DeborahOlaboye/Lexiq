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
 * Stablecoins MiniPay supports, with the address to use for each purpose.
 *
 * `token` is for balances and transfers. `feeCurrency` is for the CIP-64 fee field, and for
 * USDC/USDT these are NOT the same — those need their FeeCurrencyDirectory adapter, and a
 * transaction naming the plain token address fails. USDm is 18 decimals and uses itself.
 */
export const STABLES = [
  { symbol: "USDm", decimals: 18, token: "0x765DE816845861e75A25fCA122bb6898B8B1282a", feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a" },
  { symbol: "USDT", decimals: 6,  token: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", feeCurrency: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72" },
  { symbol: "USDC", decimals: 6,  token: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", feeCurrency: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B" },
] as const;

/**
 * Gas a player must cover themselves. Free rounds are fully sponsored, so this is only the
 * staked path: approve + startRound. Settlement is relayed and costs the player nothing.
 */
export const ROUND_GAS = 260_000n;

/**
 * Spread into writeContract() calls. Always names a fee currency.
 *
 * Do NOT omit feeCurrency to "let MiniPay decide": viem estimates and simulates locally
 * before the wallet ever sees the request, and with no fee currency it prices the tx in
 * native CELO. A MiniPay wallet holds no CELO, so that fails with "insufficient funds"
 * even when the user has plenty of stablecoin. Pass the token they actually hold.
 *
 * Staking settles in USDm; the network fee does not have to. Separate concerns.
 */
export function celoFee(feeCurrency?: `0x${string}`): { chainId: number; feeCurrency: `0x${string}` } {
  return { chainId: celo.id, feeCurrency: feeCurrency ?? FEE_CURRENCY };
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
