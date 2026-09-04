# Lexiq

Solo word race on Celo. Build as many words as you can from 7 random letters in 90 seconds.

## What it is

An on-chain solo word game for MiniPay. No opponents to wait for. Your 7 letters are drawn on-chain from a server-signed seed, weighted for the language and difficulty you picked. Play is gas-sponsored: opening a free round and settling it are both paid by the relayer, so a player never needs CELO.

Scores are signed by the game server before they settle. English cannot be validated on-chain, so without that any caller could submit letter-permutations for full points.

## Token

USDm (`0x765DE816845861e75A25fCA122bb6898B8B1282a`) for staking, on Celo mainnet.

Lexiq v2: [`0xC1224E01dbAfD97585Ac3f35DCb0291B1676d508`](https://celoscan.io/address/0xC1224E01dbAfD97585Ac3f35DCb0291B1676d508#code)

## Stack

- Frontend: Next.js 14, TailwindCSS, wagmi v2, viem
- Contracts: Solidity 0.8.28, Hardhat, OpenZeppelin
- Chain: Celo mainnet (chainId 42220)

## Scoring

A word scores **its letter values plus a length bonus**. Minimum three letters.

| Length | Bonus |   | Letters | Value |
|---|---|---|---|---|
| 3 | +2  |   | A E I O U L N S T R | 1 |
| 4 | +5  |   | D G | 2 |
| 5 | +10 |   | B C M P | 3 |
| 6 | +18 |   | F H V W Y | 4 |
| 7 | +30 |   | K | 5 |
|   |     |   | J X | 8 |
|   |     |   | Q Z | 10 |

So `CRAZE` scores 3+1+1+10+1 = 16, plus 10 for length = **26**, while `AROSE` scores 5 + 10 = **15**.
Letter values are what make Hard difficulty worth picking: it deals more rare letters.

The numbers live in `frontend/lib/scoring.ts` and the in-app guide is generated from them.

## Prizes

Players never stake and cannot lose money. When funding allows, a weekly prize pool is
deposited into the contract and split between the week's highest-scoring players.

- Entry is free — a round costs only the network fee, around 0.004 USDm
- Ranked on points accumulated across the week, so playing regularly is what wins
- **Prizes are not guaranteed** — a pool exists only in weeks one has been funded, and the
  app shows a prize only when the contract actually holds one
- Settle a week with `contracts/scripts/payout.ts`, which funds the pool and distributes it

## Setup

```bash
cd contracts && npm install
npx hardhat run scripts/deploy.ts --network celo
# Set LEXIQ_ADDRESS in frontend/lib/contracts.ts
cd ../frontend && npm install && npm run dev
```

## MiniPay

Auto-connects wallet via window.ethereum. No connect button needed. Mainnet only.
