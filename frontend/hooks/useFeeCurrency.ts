"use client";
import { useReadContracts } from "wagmi";
import { ERC20_ABI } from "@/lib/contracts";
import { STABLES, ROUND_GAS, FEE_CURRENCY, FEE_CURRENCY_DIRECTORY, FEE_CURRENCY_DIRECTORY_ABI } from "@/lib/minipay";

type FeeCurrency = {
  /** Address to pass as the CIP-64 feeCurrency (adapter for USDC/USDT). */
  address: `0x${string}`;
  /** Symbol of the token the fee will be charged against. */
  symbol: string;
  /** Balance of that token, in its own decimals. */
  balance: bigint;
  /** Balance scaled to 18 decimals, so tokens are comparable. */
  balance18: bigint;
  /** False once balances are known and none can cover a full round. */
  canAffordRound: boolean;
  loading: boolean;
};

/**
 * Picks the stablecoin a player's fees should be charged against — the one they hold most
 * of, matching how MiniPay itself chooses.
 *
 * This must be explicit. viem prices and simulates a transaction locally before handing it
 * to the wallet, so omitting feeCurrency prices it in native CELO, which a MiniPay wallet
 * never holds. Naming the wrong token fails the same way: the balance check runs against
 * whatever is named, not against what the user actually has.
 */
export function useFeeCurrency(address?: string, gasPrice?: bigint): FeeCurrency {
  const { data, isLoading } = useReadContracts({
    contracts: STABLES.map(s => ({
      address: s.token as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: address ? [address as `0x${string}`] : undefined,
    })),
    query: { enabled: !!address },
  });

  // The FeeCurrencyDirectory holds the CELO↔fee-currency rate the node itself charges against.
  const { data: rates } = useReadContracts({
    contracts: STABLES.map((s) => ({
      address: FEE_CURRENCY_DIRECTORY,
      abi: FEE_CURRENCY_DIRECTORY_ABI,
      functionName: "getExchangeRate" as const,
      args: [s.feeCurrency as `0x${string}`],
    })),
  });

  const balances = STABLES.map((s, i) => {
    const raw = (data?.[i]?.result as bigint | undefined) ?? 0n;
    return {
      ...s,
      balance: raw,
      // Scale to 18dp so a 6-decimal USDT balance compares correctly against 18-decimal USDm.
      balance18: raw * 10n ** BigInt(18 - s.decimals),
    };
  });

  const bestIndex = balances.reduce((bi, b, i) => (b.balance18 > balances[bi].balance18 ? i : bi), 0);
  const best = balances[bestIndex];

  // Cost of a whole round in the chosen token. Charging per transaction would let a player
  // start a round they cannot finish, stranding them after startRound succeeds.
  // Convert the CELO-denominated gas cost into the fee currency before comparing it to a
  // balance. Comparing the two directly treated one USDT as one CELO, which at the current
  // rate overstates the cost by more than an order of magnitude and tells players with ample
  // balance that they cannot afford to play.
  const rate = rates?.[bestIndex]?.result as readonly [bigint, bigint] | undefined;
  const roundCostCelo = gasPrice ? ROUND_GAS * gasPrice : 0n;
  const roundCost18 = rate && rate[1] > 0n ? (roundCostCelo * rate[0]) / rate[1] : 0n;

  return {
    address: (best.balance18 > 0n ? best.feeCurrency : FEE_CURRENCY) as `0x${string}`,
    symbol: best.balance18 > 0n ? best.symbol : "USDm",
    balance: best.balance,
    balance18: best.balance18,
    // Unknown price means don't block: let the wallet be the judge rather than guessing.
    canAffordRound: roundCost18 === 0n ? true : best.balance18 >= roundCost18,
    loading: isLoading,
  };
}
