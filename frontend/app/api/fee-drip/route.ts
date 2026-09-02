import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, isAddress, parseUnits, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { USDM_ADDRESS, ERC20_ABI } from "@/lib/contracts";
import { getServerAttributionTag } from "@/lib/attribution";
import { getRedis } from "@/lib/redis";

const RPC = "https://forno.celo.org";

/** Enough for roughly eight rounds at ~0.006 USDm each. */
const DRIP_AMOUNT = parseUnits(process.env.FEE_DRIP_AMOUNT ?? "0.05", 18);
/** Only top up wallets that genuinely cannot transact. */
const DRIP_THRESHOLD = parseUnits("0.01", 18);
/** Stop dripping before the relayer can no longer relay guest rounds. */
const RELAYER_FLOOR = parseUnits(process.env.FEE_DRIP_RELAYER_FLOOR ?? "1", 18);
/** Ceiling on new wallets funded per day, so a farming run has a bounded cost. */
const MAX_DAILY_DRIPS = Number(process.env.FEE_DRIP_DAILY_CAP ?? 500);

/**
 * POST /api/fee-drip  { address }
 *
 * Sends a one-time USDm top-up so a MiniPay wallet can pay its own network fees.
 * Fee abstraction changes which token pays the fee, not who pays it, so a wallet
 * holding zero USDm cannot transact at all — this covers that first step.
 *
 * MiniPay supports no message signing, so the caller cannot prove ownership of the
 * address. That makes this endpoint inherently spoofable; it is bounded rather than
 * authenticated — one drip per address ever, only below a threshold, under a daily cap,
 * and never below the relayer's own floor.
 */
export async function POST(req: NextRequest) {
  const pk = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) return NextResponse.json({ error: "Drip not configured" }, { status: 503 });

  let body: { address?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  if (!body.address || !isAddress(body.address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const to = getAddress(body.address);

  const kv = getRedis();
  if (!kv) return NextResponse.json({ error: "Drip unavailable" }, { status: 503 });

  try {
    // Claim the slot before spending anything. SET NX is atomic, so two concurrent
    // requests for the same address cannot both proceed to a transfer.
    const claimed = await kv.set(`lx:drip:${to.toLowerCase()}`, Date.now().toString(), "NX");
    if (claimed !== "OK") {
      return NextResponse.json({ ok: false, reason: "already_dripped" });
    }

    const publicClient = createPublicClient({ chain: celo, transport: http(RPC) });
    const account = privateKeyToAccount(pk);

    const release = () => kv.del(`lx:drip:${to.toLowerCase()}`).catch(() => {});

    const balance = await publicClient.readContract({
      address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [to],
    }) as bigint;
    if (balance >= DRIP_THRESHOLD) {
      await release();
      return NextResponse.json({ ok: false, reason: "sufficient_balance" });
    }

    const relayerBalance = await publicClient.readContract({
      address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address],
    }) as bigint;
    if (relayerBalance < RELAYER_FLOOR + DRIP_AMOUNT) {
      await release();
      console.warn("[fee-drip] relayer USDm below floor, refusing to drip");
      return NextResponse.json({ ok: false, reason: "relayer_low" });
    }

    const dayKey = `lx:drip:day:${new Date().toISOString().slice(0, 10)}`;
    const todayCount = await kv.incr(dayKey);
    if (todayCount === 1) await kv.expire(dayKey, 172800);
    if (todayCount > MAX_DAILY_DRIPS) {
      await release();
      return NextResponse.json({ ok: false, reason: "daily_cap" });
    }

    const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC) });
    const gasPrice = await publicClient.getGasPrice();
    const tag = getServerAttributionTag();

    const hash = await walletClient.writeContract({
      address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "transfer",
      args: [to, DRIP_AMOUNT],
      gasPrice: gasPrice + gasPrice / 5n,
      gas: 100_000n,
      ...(tag ? { dataSuffix: tag } : {}),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      await release();
      return NextResponse.json({ error: "Drip reverted" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, txHash: hash });
  } catch (err) {
    console.error("[fee-drip]", err);
    // Leave the address claim in place on an unknown error: a stuck claim costs one user a
    // retry, whereas releasing it after a transfer that may have landed risks paying twice.
    return NextResponse.json({ error: "Drip failed" }, { status: 500 });
  }
}
