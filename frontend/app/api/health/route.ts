import { NextResponse } from "next/server";
import { configReport } from "@/lib/config";
import { publicClient, accountFrom } from "@/lib/attestation";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import { getServerAttributionTag } from "@/lib/attribution";
import { relayHealth, relayedToday } from "@/lib/ratelimit";

/**
 * Derives an address from a key without ever revealing it, through the same normaliser the
 * signing path uses — a separate copy here drifted and reported a usable key as broken.
 */
function addressOf(envVar: string): { ok: boolean; address?: string; error?: string } {
  try {
    return { ok: true, address: accountFrom(envVar).address };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message?.slice(0, 100) ?? "invalid" };
  }
}

/**
 * Post-deploy check. Reports whether the app can actually run a round.
 *
 * Presence is not enough: a key that is malformed, or simply belongs to a different account
 * than the contract was deployed with, looks identical to a correct one in the environment
 * and only fails when somebody tries to play. So derive both addresses and compare them
 * against what the contract itself says it trusts.
 */
export async function GET() {
  const config = configReport();
  const signer = addressOf("GAME_SIGNER_PRIVATE_KEY");
  const relayer = addressOf("RELAYER_PRIVATE_KEY");

  let chain: Record<string, unknown>;
  let keysMatchChain = false;
  try {
    const [rounds, onChainSigner, onChainRelayer] = await Promise.all([
      publicClient.readContract({ address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "totalRounds" }),
      publicClient.readContract({ address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "gameSigner" }),
      publicClient.readContract({ address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "relayer" }),
    ]);
    const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
    keysMatchChain = same(signer.address, onChainSigner as string) && same(relayer.address, onChainRelayer as string);

    chain = {
      reachable: true,
      totalRounds: (rounds as bigint).toString(),
      gameSigner: { configured: signer.address ?? signer.error, onChain: onChainSigner, match: same(signer.address, onChainSigner as string) },
      relayer:    { configured: relayer.address ?? relayer.error, onChain: onChainRelayer, match: same(relayer.address, onChainRelayer as string) },
      relayerCelo: relayer.address
        ? (Number(await publicClient.getBalance({ address: relayer.address as `0x${string}` })) / 1e18).toFixed(4)
        : null,
    };
  } catch (err) {
    chain = { reachable: false, error: (err as Error)?.message?.slice(0, 160) };
  }

  // The attribution package is ESM-only and has failed at runtime inside a route before,
  // where the error was swallowed and transactions silently went out untagged.
  let attribution: string;
  try {
    attribution = getServerAttributionTag() ? "ok" : "no tag derived";
  } catch (err) {
    attribution = `FAILING: ${(err as Error)?.message?.slice(0, 80)}`;
  }

  // Which tier the relayer is in, and what it has spent today. Without this the thresholds
  // are invisible: guests would quietly stop being relayed with nothing anywhere saying why.
  const relay = {
    state: await relayHealth(),
    roundsToday: await relayedToday(),
    guestFloorCelo: process.env.RELAY_GUEST_MIN_CELO ?? "2",
    stopFloorCelo: process.env.RELAY_MIN_CELO ?? "0.5",
  };

  const ok = config.missing.length === 0 && config.contractLooksValid
    && signer.ok && relayer.ok && chain.reachable === true && keysMatchChain;

  return NextResponse.json({ ok, config, chain, relay, attribution }, { status: ok ? 200 : 503 });
}
