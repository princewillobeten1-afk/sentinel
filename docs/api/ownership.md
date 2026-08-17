# Ownership

Holder concentration, clustering, and wallet-relationship graphs. Runs the
real `calculateEffectiveOwnership` engine against raw mock holder/cluster
data (`lib/ownership/context-builder.ts`) — not a pre-computed literal.

**Scope:** `READ_REPUTATION`. **Auth:** `optionalAuth`.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/ownership/:chain/:token` | Full effective-ownership report |
| `GET /api/v1/ownership/:chain/:token/clusters` | Holder clusters |
| `GET /api/v1/ownership/:chain/:token/timeline` | Concentration-change timeline |
| `GET /api/v1/ownership/wallet/:address` | Every relationship edge involving a wallet |

`ownership/wallet/:address` currently has no wallet-ownership gating — it
returns relationship data for any address, unlike the [portfolio](./portfolio.md)
endpoints which require the caller to own the wallet in question. That's a
real scope gap, not a design choice, and worth closing before this endpoint
is used for anything sensitive.

```bash
curl https://your-host/api/v1/ownership/solana/QUANT/clusters \
  -H "Authorization: Bearer sk_live_..."
```
