import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  // 0.8.24+ is required by OpenZeppelin 5's EIP712, and OZ's Bytes.sol uses `mcopy`, so the
  // target must be cancun. Verified live: Celo mainnet headers carry parentBeaconBlockRoot
  // and blobGasUsed, so the chain is at Cancun or later.
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: {
    celo: { url: "https://forno.celo.org", accounts: [PRIVATE_KEY], chainId: 42220 },
  },
  etherscan: {
    apiKey: process.env.CELOSCAN_API_KEY ?? "",
    customChains: [{
      network: "celo", chainId: 42220,
      urls: { apiURL: "https://api.celoscan.io/api", browserURL: "https://celoscan.io" },
    }],
  },
  sourcify: { enabled: false },
};
export default config;
