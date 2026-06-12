import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    celo: { url: "https://forno.celo.org", accounts: [PRIVATE_KEY], chainId: 42220 },
  },
  etherscan: {
    apiKey: { celo: process.env.CELOSCAN_API_KEY ?? "" },
    customChains: [{
      network: "celo", chainId: 42220,
      urls: { apiURL: "https://api.celoscan.io/api", browserURL: "https://celoscan.io" },
    }],
  },
};
export default config;
