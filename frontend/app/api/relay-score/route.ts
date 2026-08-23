import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { LEXIQ_ADDRESS, LEXIQ_ABI } from "@/lib/contracts";
import type { Lang } from "@/lib/guestLetters";
import rawEn from "an-array-of-english-words";
import rawEs from "an-array-of-spanish-words";
import rawFr from "an-array-of-french-words";

const SCORE: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 5, 6: 8, 7: 11 };

function normalize(w: string): string {
  return w.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}
function buildDict(raw: unknown): Set<string> {
  return new Set((raw as string[]).map(normalize).filter(w => /^[A-Z]{2,7}$/.test(w)));
}
const DICTS: Record<string, Set<string>> = {
  en: buildDict(rawEn),
  es: buildDict(rawEs),
  fr: buildDict(rawFr),
};

function randomSalt(): `0x${string}` {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return `0x${Array.from(arr, b => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

function hashWord(word: string, salt: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(["string", "bytes32"], [word.toUpperCase(), salt]));
}

const RPC = "https://forno.celo.org";

export async function POST(req: NextRequest) {
  const pk = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) return NextResponse.json({ error: "Relay not configured" }, { status: 503 });

  let body: { words?: string[]; difficulty?: number; lang?: Lang };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const rawWords: string[] = (body.words ?? []).map(w => normalize(w));
  const difficulty: 0 | 1 | 2 = ([0, 1, 2].includes(body.difficulty ?? -1) ? body.difficulty : 1) as 0 | 1 | 2;
  const lang: Lang = (["en", "es", "fr"].includes(body.lang ?? "") ? body.lang : "en") as Lang;

  // Server-side validation — dedupe and check dictionary
  const dict = DICTS[lang] ?? DICTS.en;
  const seen = new Set<string>();
  const validWords = rawWords.filter(w => dict.has(w) && !seen.has(w) && seen.add(w));
  if (validWords.length === 0) return NextResponse.json({ error: "No valid words" }, { status: 400 });

  const account = privateKeyToAccount(pk);
  const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC) });
  const publicClient = createPublicClient({ chain: celo, transport: http(RPC) });

  // Fetch a fresh gas price before each write so it always clears the current block base fee
  async function freshGasPrice() {
    const gp = await publicClient.getGasPrice();
    return gp * 2n; // 2× buffer above current base fee
  }

  try {
    // 1. Simulate startRound to get the roundId before writing
    const { result: roundId } = await publicClient.simulateContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "startRound",
      args: [0n, difficulty], account,
    });

    // 2. Submit startRound
    const startHash = await walletClient.writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "startRound",
      args: [0n, difficulty], gasPrice: await freshGasPrice(), gas: 300_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: startHash });

    // 3. commitWords — generate salts server-side so hashes are trustworthy
    const salts = validWords.map(() => randomSalt());
    const hashes = validWords.map((w, i) => hashWord(w, salts[i]));

    // 80k base + 30k per word — covers up to ~30 words comfortably
    const commitGas = BigInt(80_000 + validWords.length * 30_000);

    const commitHash = await walletClient.writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "commitWords",
      args: [roundId as bigint, hashes], gasPrice: await freshGasPrice(), gas: commitGas,
    });
    await publicClient.waitForTransactionReceipt({ hash: commitHash });

    // 4. revealWords — 120k base + 40k per word
    const revealGas = BigInt(120_000 + validWords.length * 40_000);

    const revealHash = await walletClient.writeContract({
      address: LEXIQ_ADDRESS, abi: LEXIQ_ABI, functionName: "revealWords",
      args: [roundId as bigint, validWords, salts], gasPrice: await freshGasPrice(), gas: revealGas,
    });
    await publicClient.waitForTransactionReceipt({ hash: revealHash });

    const score = validWords.reduce((s, w) => s + (SCORE[w.length] ?? 11), 0);
    return NextResponse.json({
      ok: true,
      roundId: (roundId as bigint).toString(),
      score,
      wordCount: validWords.length,
      txHash: revealHash,
    });
  } catch (err) {
    console.error("[relay-score]", err);
    return NextResponse.json({ error: "Relay failed" }, { status: 500 });
  }
}
