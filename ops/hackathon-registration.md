# Agents at Work — registration facts

Values for the celobuilders.xyz registration form. Deadline 21 Sep 2026 09:00 GMT.

| Field | Value |
|---|---|
| `projectName` | LexIQ |
| `githubUrl` | https://github.com/DeborahOlaboye/Lexiq (must be public) |
| `erc8004Url` | https://8004scan.io/agents/celo/9835 |
| `agentWalletAddress` | 0x9CB49e92D3E6EDfC4F8DCA3e5a20C5b142FC4237 |
| `askbotsProjectUrl` | https://askbots.ai/p/k17bvtmmwty1kqyznmahevjztx8e8jya |
| `ownContracts` | 0xC1224E01dbAfD97585Ac3f35DCb0291B1676d508 |
| `celoNetwork` | mainnet |
| `primaryTrack` | judges-favorite |
| `telegram` | @debielily |
| `socialLink` | (X post tagging @CeloDevs and @Celo — still to write) |

## ERC-8004 agent

Agent ID 9835, "LexIQ Opponent", registered 12 Sep 2026.
Registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (Celo mainnet).
Registration tx `0x5ae50bfa256c8fe0a168209659cae218498ec9ad928c12a857c9b6f038b223c0`.

Metadata is a `data:` URI, so it lives on-chain and is content-addressed — nothing to pin,
nothing that can be mutated after the fact. Update it with `setAgentURI(9835, uri)` from the
owner wallet; the agent id itself never changes.

## Attribution — done

Registered 12 Sep 2026. Assigned tag `celo_a7cd3616d8b0`, derived from the GitHub owner/repo
slug and locked at first save. Wired into lib/attribution.ts as a multi-code suffix alongside
the domain-derived `celo_06d24d32051f`, and verified by decoding a real suffix and confirming
both codes are carried.

Only the assigned code is credited. Transactions sent before this shipped carry the domain
code alone and cannot be re-tagged, so the rounds played before registration count for nothing
and are not recoverable.

The submission is a DRAFT. Drafts appear on the leaderboard flagged as not eligible, so it
must be published before 21 Sep 09:00 GMT — which needs the socialLink field.
