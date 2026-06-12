import { ethers } from "hardhat";

const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const Lexiq = await ethers.getContractFactory("Lexiq");
  const contract = await Lexiq.deploy(USDM_ADDRESS);
  await contract.waitForDeployment();
  console.log("Lexiq deployed to:", await contract.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
