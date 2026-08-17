# Execution

Quotes, preflight simulation, and trade submission. **Backed entirely by a
simulated fill engine** (`lib/execution/engine.ts`'s `MockUniswapAdapter`) —
there is no real DEX integration. The gateway around it (auth, scope,
idempotency) is real; the fill is not.

**Scope:** `TRADE` — a dangerous scope, never auto-granted. **Auth:**
`allowSessionAuth` (no `optionalAuth` — trading was never public).

| Endpoint | Returns |
|---|---|
| `POST /api/v1/execution/quote` | Quotes for an `ExecutionRequest` (dry-run, no execution) |
| `POST /api/v1/execution/simulate` | Preflight check against a quote (dry-run, no execution) |
| `POST /api/v1/execution/submit` | **Executes** the trade. `idempotent: true` |
| `POST /api/v1/trading/prepare` | Prepares an unsigned transaction for client-side signing. `idempotent: true` |

`execution/submit` was, before this sprint, the highest-risk fully
unauthenticated write found anywhere in the API — no auth, no scope, a
hardcoded `wallet: '0xUser'` default. It's now gated behind `TRADE` and
defaults `wallet` to the caller's own `primaryWalletAddress` instead of that
placeholder.

## Safety separation

`quote`, `simulate`, and `submit` are strictly separate endpoints — nothing
here lets fetching a quote silently execute a trade. A client (including the
[SDK](../../sdk/typescript/README.md)) must explicitly call `submit` to
execute anything, and the server independently re-enforces the `TRADE` scope
on that call regardless of what happened in `quote`/`simulate`.

```bash
curl -X POST https://your-host/api/v1/execution/submit \
  -H "Authorization: Bearer sk_live_..." \
  -H "Idempotency-Key: order-2026-08-13-001" \
  -H "Content-Type: application/json" \
  -d '{"quote": {...}, "request": {...}}'
```
