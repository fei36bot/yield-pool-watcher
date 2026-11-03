# Yield Pool Watcher

Agent for [daydreamsai/agent-bounties#6](https://github.com/daydreamsai/agent-bounties/issues/6).

- Live pool TVL/APY from DefiLlama Yields API
- Threshold alerts on TVL % change and APY absolute change
- x402-gated invoke via `@lucid-dreams/agent-kit`

## Endpoints

- `GET /health`
- `GET /.well-known/agent.json`
- `POST /entrypoints/yield-watch/invoke` (402 unpaid)

## Wallets

- EVM payTo: `0xDFb67e2ed78F174e76Cf5Cfc87Ab39733f7a5c62`
- Solana: `2NchCPMdxc8en5Wo6o6aM1PUiZG2tChd7huFB2nsYJJB`
