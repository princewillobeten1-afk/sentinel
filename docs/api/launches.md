# Launches

Bonding-curve launch preflight analysis, deployment, and simulation.

**Scope:** `CREATE_LAUNCH` for `analyze`/`deploy` (dangerous, never
auto-granted); reads are `optionalAuth`.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/launches` | Discovery-feed-style list (currently a stub — one hardcoded entry) |
| `GET /api/v1/launches/:id` | Launch config + bonding-curve state (currently a stub, not backed by a real store) |
| `GET /api/v1/launches/:id/intelligence` | Launch intelligence |
| `POST /api/v1/launches/:id/simulate` | Simulates a BUY/SELL against a bonding-curve state |
| `POST /api/v1/launches` `{"action":"ANALYZE", ...}` | Preflight risk analysis only — does not deploy |
| `POST /api/v1/launches` `{"action":"DEPLOY", ...}` | Deploys the launch. Rejected server-side if preflight risk is `CRITICAL`. `idempotent: true` |

## What's real here

Only `preflightAnalysis()` → `LaunchRiskEngine.analyzePreLaunch()` is a real
risk engine. `deployLaunch()` is simulated — no token is actually deployed
on-chain. `GET /api/v1/launches` and `GET /api/v1/launches/:id` are
literal-response stubs, not wired to a launch store at all yet. This split
is deliberate and stated plainly rather than hidden: the sprint wired the
gateway (auth/scope/idempotency) around the real and stub pieces alike,
without pretending the stub pieces are more real than they are.

```bash
curl -X POST https://your-host/api/v1/launches \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"action": "ANALYZE", "config": {...}}'
```
