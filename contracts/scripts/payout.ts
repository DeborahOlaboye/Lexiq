import { ethers } from "hardhat";

/**
 * Settle a week: fund the prize pool, then split it among the top players.
 *
 * Players do not stake, so the pool only ever holds what we put in it — and prizes depend on
 * having funding that week. Nothing here assumes a prize exists; `--fund 0` simply distributes
 * whatever is already in the pool, and a week with no funding is skipped entirely.
 *
 *   FUND=25 SPLIT=40,25,15,10,10 WINNERS=0xabc,0xdef,... npx hardhat run scripts/payout.ts --network celo
 *
 * FUND     USDm to add to the pool first (omit or 0 to distribute what is already there)
 * WINNERS  comma-separated addresses, best first — take these from /api/weekly
 * SPLIT    comma-separated percentages, same length as WINNERS, must total 100
 * DRY      set to 1 to print the plan without sending anything
 *
 * Before paying, check the week for flagged rounds — coverage no human reaches:
 *   ssh <server> 'docker compose -f /opt/lexiq/docker-compose.yml exec redis \
 *     redis-cli LRANGE lx:flagged:$(date -u +%G-W%V) 0 -1'
 */
async function main() {
  const lexiqAddress = process.env.LEXIQ_ADDRESS;
  if (!lexiqAddress) throw new Error("Set LEXIQ_ADDRESS");

  const winners = (process.env.WINNERS ?? "").split(",").map((w) => w.trim()).filter(Boolean);
  const split = (process.env.SPLIT ?? "").split(",").map((n) => Number(n.trim())).filter((n) => !Number.isNaN(n));
  const fund = process.env.FUND ?? "0";
  const dry = process.env.DRY === "1";

  if (winners.length === 0) throw new Error("Set WINNERS");
  if (split.length !== winners.length) throw new Error(`SPLIT has ${split.length} entries for ${winners.length} winners`);
  const total = split.reduce((a, b) => a + b, 0);
  if (total !== 100) throw new Error(`SPLIT totals ${total}, must total 100`);

  const [signer] = await ethers.getSigners();
  const lexiq = await ethers.getContractAt("Lexiq", lexiqAddress, signer);
  const usdm = await ethers.getContractAt("IERC20", await lexiq.usdm(), signer);

  const owner = await lexiq.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Only the owner can distribute. Owner is ${owner}, you are ${signer.address}`);
  }

  const fundWei = ethers.parseUnits(fund, 18);
  if (fundWei > 0n) {
    const balance = await usdm.balanceOf(signer.address);
    if (balance < fundWei) {
      throw new Error(`Need ${fund} USDm to fund, wallet holds ${ethers.formatUnits(balance, 18)}`);
    }
    console.log(`Funding pool with ${fund} USDm…`);
    if (!dry) {
      await (await usdm.approve(lexiqAddress, fundWei)).wait();
      await (await lexiq.depositWeeklyPrize(fundWei)).wait();
    }
  }

  const pool: bigint = await lexiq.weeklyPrizePool();
  console.log(`Prize pool: ${ethers.formatUnits(pool, 18)} USDm`);
  if (pool === 0n) {
    console.log("Pool is empty — nothing to distribute. Skipping this week.");
    return;
  }

  // The last winner takes the remainder, so rounding never leaves dust behind or overshoots
  // the pool — distributePrize reverts if the total exceeds it.
  const amounts: bigint[] = [];
  let assigned = 0n;
  split.forEach((pct, i) => {
    const amount = i === split.length - 1 ? pool - assigned : (pool * BigInt(pct)) / 100n;
    amounts.push(amount);
    assigned += amount;
  });

  console.log("\nPayout:");
  winners.forEach((w, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${w}  ${ethers.formatUnits(amounts[i], 18)} USDm  (${split[i]}%)`);
  });
  console.log(`  total: ${ethers.formatUnits(assigned, 18)} of ${ethers.formatUnits(pool, 18)}`);

  if (dry) {
    console.log("\nDRY=1 — nothing sent.");
    return;
  }

  const tx = await lexiq.distributePrize(winners, amounts);
  console.log(`\ndistributePrize: ${tx.hash}`);
  await tx.wait();
  console.log("Done. Pool is now", ethers.formatUnits(await lexiq.weeklyPrizePool(), 18), "USDm");
}

main().catch((e) => { console.error(e); process.exit(1); });
