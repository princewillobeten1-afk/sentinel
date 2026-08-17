# Intelligence

Token risk scoring across contract, liquidity, market and on-chain-activity
dimensions. Real engines (`lib/intelligence/report-generator.ts`,
`lib/activity/*`) over mock/simulated market data — not literal canned
responses.

**Scope:** `READ_TOKEN_INTELLIGENCE`. **Auth:** `optionalAuth` — works
unauthenticated exactly as the public web app always has; a presented API
key gets full scope/rate-limit/usage treatment.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/intelligence/:chain/:token` | Full report: overall score, risk level, all dimensions, signals, warnings, positives |
| `GET /api/v1/intelligence/:chain/:token/contract` | Contract risk dimension only |
| `GET /api/v1/intelligence/:chain/:token/liquidity` | Liquidity dimension, pools, price-impact estimates |
| `GET /api/v1/intelligence/:chain/:token/market` | Market risk dimension only |
| `GET /api/v1/intelligence/:chain/:token/signals` | Every signal (with evidence) behind the score |
| `GET /api/v1/intelligence/:chain/:token/activity?window=1h` | Organic/insider/feature-store analysis for a window |
| `GET /api/v1/intelligence/:chain/:token/organic?window=1h` | Organic-volume assessment across `1m`–`7d` windows |
| `GET /api/v1/intelligence/:chain/:token/insiders` | Insider-candidate detection |
| `GET /api/v1/intelligence/:chain/:token/history` | Historical score snapshots |
| `GET /api/v1/intelligence/:chain/:token/timeline` | Event timeline |

`:chain` is currently always `solana`; `:token` is a symbol (`SENT`,
`QUANT`, `BONK`, `ALPHA` in the mock data set).

```bash
curl https://your-host/api/v1/intelligence/solana/SENT \
  -H "Authorization: Bearer sk_live_..."
```
