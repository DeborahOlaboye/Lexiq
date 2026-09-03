import { NextResponse } from "next/server";
import { configReport } from "@/lib/config";
import { publicClient } from "@/lib/attestation";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";

/**
 * Post-deploy check. Reports whether the app is actually able to run a round, so a
 * misconfiguration shows up here rather than the first time a real player tries to start one.
 * Reports only presence and public values — never a secret.
 */
export async function GET() {
  const config = configReport();

  let chain: { reachable: boolean; totalRounds?: string; relayerCelo?: string; error?: string };
  try {
    const [rounds, balance] = await Promise.all([
      publicClient.readContract({ address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "totalRounds" }),
      // The relayer funds every sponsored round; an empty one stops play as surely as a
      // missing key, and does it silently.
      process.env.RELAYER_PRIVATE_KEY
        ? import("@/lib/attestation").then(async (m) =>
            publicClient.getBalance({ address: m.relayerAccount().address }))
        : Promise.resolve(null),
    ]);
    chain = {
      reachable: true,
      totalRounds: (rounds as bigint).toString(),
      relayerCelo: balance === null ? undefined : (Number(balance) / 1e18).toFixed(4),
    };
  } catch (err) {
    chain = { reachable: false, error: (err as Error)?.message?.slice(0, 120) };
  }

  const ok = config.missing.length === 0 && config.contractLooksValid && chain.reachable;
  return NextResponse.json({ ok, config, chain }, { status: ok ? 200 : 503 });
}
