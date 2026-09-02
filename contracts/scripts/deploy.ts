import { ethers } from "hardhat";

const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

/**
 * GAME_SIGNER_ADDRESS signs score and seed attestations — it is authoritative over scoring.
 * RELAYER_ADDRESS only opens free rounds so play can be sponsored.
 * Keep the two keys separate: losing the relayer costs gas money, losing the signer lets
 * scores be forged.
 */
async function main() {
  const gameSigner = process.env.GAME_SIGNER_ADDRESS;
  const relayer    = process.env.RELAYER_ADDRESS;

  if (!gameSigner || !relayer) {
    throw new Error("Set GAME_SIGNER_ADDRESS and RELAYER_ADDRESS in .env before deploying");
  }
  if (gameSigner.toLowerCase() === relayer.toLowerCase()) {
    throw new Error("GAME_SIGNER_ADDRESS and RELAYER_ADDRESS must be different keys");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer   :", deployer.address);
  console.log("USDm       :", USDM_ADDRESS);
  console.log("Game signer:", gameSigner);
  console.log("Relayer    :", relayer);

  const contract = await (await ethers.getContractFactory("Lexiq"))
    .deploy(USDM_ADDRESS, gameSigner, relayer);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nLexiq deployed to:", address);
  console.log(`\nVerify with:\n  npx hardhat verify --network celo ${address} ${USDM_ADDRESS} ${gameSigner} ${relayer}`);
  console.log(`\nThen set LEXIQ_ADDRESS in frontend/lib/contracts.ts to ${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
