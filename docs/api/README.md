# Project Sentinel API

Sentinel's REST + WebSocket API for programmatic access to token
intelligence, exitability, ownership, creator reputation, discovery,
portfolio, execution, launches, and real-time streaming.

This is Sprint 28's **deep core** — a genuinely working gateway with real
auth, scopes, rate limiting and idempotency wired through a curated set of
domains, not a shallow pass over every route in the app. See
[What's real vs. simulated](#whats-real-vs-simulated) below for exactly
where the line is.

## Base URL

Locally, this is whatever host/port `node server.js` is listening on (e.g.
`http://localhost:3000`). All routes below are relative to that base.

## Authentication

Two credential paths, resolved per-route:

1. **API key** — `Authorization: Bearer sk_live_...` or `sk_sandbox_...`.
   Created via the [Developer dashboard](../../components/views/developer-dashboard-view.tsx)
   or `POST /api/v1/user/api-keys` (session-auth only — a key can never mint
   another key). Every API key request gets full scope enforcement, rate
   limiting, and usage logging.
2. **Session** — the same cookie/JWT the web app itself uses
   (`Authorization: Bearer <session-jwt>` or a `sentinel_session` cookie).
   Only routes that opt into `allowSessionAuth` accept this path; scopes are
   not enforced for session-authenticated requests (a logged-in user acting
   through the web app already has whatever access their account has).

Routes that were already public before this sprint (e.g. token intelligence)
use `optionalAuth`: no credential still works, exactly as before, but a
presented API key gets full scope/rate-limit/usage treatment on top.

See [`scopes.md`](./scopes.md) for the full permission model.

## Versioning

Everything here lives under `/api/v1/**`. There is no deprecation policy yet
— this is a v1 that hasn't shipped a v2.

## Response envelope

Every response (success or error) is JSON:

```json
{ "success": true, "data": { /* ... */ } }
```

```json
{
  "success": false,
  "error": { "message": "...", "code": "SOME_ERROR_CODE", "details": { } }
}
```

`code` is a stable machine-readable string (e.g. `INSUFFICIENT_SCOPE`,
`RATE_LIMITED`, `WALLET_NOT_AUTHORIZED`) — match on it, not on `message`.

## Headers

Every gateway response carries:

| Header | Meaning |
|---|---|
| `X-Request-Id` | Unique per request — include it when reporting an issue |
| `X-RateLimit-Limit` | Requests allowed in the current window (API-key auth only) |
| `X-RateLimit-Remaining` | Requests left in the current window |
| `X-RateLimit-Reset` | Unix timestamp the window resets |

Rate-limit headers only appear on API-key-authenticated requests — session
auth and anonymous requests aren't rate-limited by the gateway itself (the
existing app-level `lib/server/rate-limit.ts` still applies to some routes,
e.g. discovery screening, independent of this).

## Rate limits

Tiered by API key (`FREE` by default on creation):

| Tier | Requests/min | Daily cap |
|---|---|---|
| FREE | 30 (+10 burst) | 5,000 |
| DEVELOPER | 120 | 50,000 |
| PRO | 600 | 500,000 |
| BUSINESS | 3,000 | 5,000,000 |
| ENTERPRISE | 20,000 | 50,000,000 |

A 429 carries `Retry-After` and the same `X-RateLimit-*` headers. See
`lib/server/rate-limit-v2.ts`.

## Idempotency

Write endpoints that matter to retry safely (order/trade submission, launch
deployment, webhook creation) accept an `Idempotency-Key` header. The same
key + same request body replays the original response; the same key with a
**different** body is rejected with `409 IDEMPOTENCY_KEY_CONFLICT`. Keys are
remembered for 24h. See `lib/server/idempotency.ts`.

## Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_*` | Malformed request |
| 401 | `API_KEY_REQUIRED`, `API_KEY_INVALID`, `AUTH_REQUIRED` | No/bad credential |
| 403 | `INSUFFICIENT_SCOPE`, `WALLET_NOT_AUTHORIZED` | Credential valid, not allowed to do this |
| 404 | `NOT_FOUND`, `TOKEN_NOT_FOUND` | Resource doesn't exist |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | Reused idempotency key with a different body |
| 429 | `RATE_LIMITED` | Over your tier's limit |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

## Domains

| Doc | Covers |
|---|---|
| [`scopes.md`](./scopes.md) | Full permission model |
| [`intelligence.md`](./intelligence.md) | Token risk scoring |
| [`exitability.md`](./exitability.md) | Exit simulation, Smart Alerts |
| [`ownership.md`](./ownership.md) | Holder concentration, clusters |
| [`creator.md`](./creator.md) | Deployer identity & reputation |
| [`discovery.md`](./discovery.md) | Ranked token feeds |
| [`portfolio.md`](./portfolio.md) | Cost basis, P&L, risk, exposure |
| [`execution.md`](./execution.md) | Quotes, simulation, trade submission |
| [`launches.md`](./launches.md) | Bonding-curve launch analysis/deploy |
| [`alerts.md`](./alerts.md) | How alerts reach you (via webhooks) |
| [`webhooks.md`](./webhooks.md) | HMAC-signed event delivery |
| [`websocket.md`](./websocket.md) | Real-time streaming |

## SDK

A TypeScript SDK wrapping all of the above lives at
[`sdk/typescript/`](../../sdk/typescript/README.md) (standalone package, not
published to a registry yet).

## What's real vs. simulated

| Area | Status |
|---|---|
| Gateway (auth, scopes, rate limiting, idempotency, usage logging) | **Real** |
| Intelligence, exitability, ownership, creator, discovery, portfolio (reads) | **Real** — genuine engines over the app's data layer, not literal mocks |
| Webhook delivery (HMAC signing, retry/backoff, replay protection) | **Real** — an in-process queue, not a durable message broker |
| WebSocket streaming | **Real** — a real `ws` server bridging the same event bus the web app uses |
| Execution (`quote`/`simulate`/`submit`, `trading/prepare`) | **Simulated fills** — no real DEX integration exists; the gateway around it is real |
| Launch deployment | **Simulated** — preflight risk analysis is real, `deployLaunch` is not |
| Persistence | **In-memory**, `globalThis`-guarded (survives dev hot-reload, not a process restart) — see `db/migrations/010_api_platform.sql` for the schema this would map to with a real driver |

Nothing here fakes success on a write that didn't happen — "simulated" means
the underlying fill/deployment logic is a model, not a live chain
transaction, stated plainly rather than hidden.
