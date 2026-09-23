# Solana manual swap provider

Quick Buy, the Trade panel, and the token order panel share one wallet-approved Solana mainnet swap path. Jupiter supplies the quote and serialized swap; Helius (or `SOLANA_TRADING_RPC_URL`) simulates, broadcasts, and checks the signature. The server never holds wallet private keys.

## Configuration

- Set `SOLANA_TRADING_ENABLED=true` in the server environment.
- Set `SOLANA_TRADING_RPC_URL` to a Solana **mainnet** HTTPS RPC endpoint, or retain the existing `HELIUS_RPC_URL` / `HELIUS_API_KEY`. The server checks the genesis hash before every provider is trusted.
- Optionally set `SOLANA_TRADING_FALLBACK_RPC_URL` to another mainnet HTTPS RPC. It receives exactly the same signed bytes after an uncertain primary result.
- Optionally set `JUPITER_API_KEY` for Jupiter's keyed API; without it the server uses Jupiter's public lite API.
- Configure `DATABASE_URL` and run `npm run db:migrate`. Migration 034 stores prepared intents and signatures before broadcast.

`GET /api/v1/trading/capabilities` reports provider and database readiness without exposing RPC credentials. `POST /api/v1/trading/quote` is read-only and can verify Jupiter routing. Never use a quote or a successful `sendTransaction` response as proof of confirmation; the status endpoint checks the signature on chain.

## Execution and recovery

The user reviews a fresh quote and acknowledges mainnet funds. Prepare refreshes the quote, enforces the reviewed minimum output and price impact limit, checks the priority fee cap, simulates the transaction, estimates the network fee, and stores the unsigned transaction. The connected wallet signs the exact stored message. Submit verifies that signature, saves it durably, then broadcasts. `GET /api/v1/trading/status/:preparedId` checks confirmation or failure. A pending or uncertain result keeps the signature available for inspection; it never creates a replacement transaction automatically.

The old execution, wallet withdrawal/deposit simulation, and emergency-exit endpoints cannot create claimed mainnet confirmations. Wallet Management's Send flow is separate and currently uses **Solana devnet**. Automated orders and private MEV relay are not configured by this provider.

## Local verification

Run `docker compose up -d db redis`, `npm run db:migrate`, `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm test`. Read-only smoke checks can query `/api/v1/trading/capabilities` and `/api/v1/trading/quote`. Testing a real broadcast requires a user-controlled funded wallet and explicit wallet approval; it is not part of automated tests.
