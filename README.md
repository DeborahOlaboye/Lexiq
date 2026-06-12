# Lexiq

Solo word race on Celo. Build as many words as you can from 7 random letters in 90 seconds.

## What it is

A fully on-chain solo word game for MiniPay. No opponents to wait for. Your 7 letters come from a keccak256 seed derived from block data. Words are committed on-chain during the round and revealed at the end via commit-reveal.

## Token

Uses USDM (0x765DE816845861e75A25fCA122bb6898B8B1282a) on Celo mainnet.

## Stack

- Frontend: Next.js 14, TailwindCSS, wagmi v2, viem
- Contracts: Solidity 0.8.20, Hardhat, OpenZeppelin
- Chain: Celo mainnet (chainId 42220)

## Scoring

| Length | Points |
|---|---|
| 2 letters | 1 pt |
| 3 letters | 2 pts |
| 4 letters | 3 pts |
| 5 letters | 5 pts |
| 6 letters | 8 pts |
| 7+ letters | 11 pts |

## Stake Mechanic

- Optional USDM stake
- Score 10+ pts to get stake back (minus 1% fee)
- Score under 10 pts = stake goes to weekly prize pool

## Setup

```bash
cd contracts && npm install
npx hardhat run scripts/deploy.ts --network celo
# Set LEXIQ_ADDRESS in frontend/lib/contracts.ts
cd ../frontend && npm install && npm run dev
```

## MiniPay

Auto-connects wallet via window.ethereum. No connect button needed. Mainnet only.
