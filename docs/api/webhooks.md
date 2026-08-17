# Webhooks

HMAC-signed HTTP delivery for real-time events. In-memory queue with
exponential-backoff retry — real delivery mechanics, not a durable message
broker (a process restart loses in-flight retries; stated plainly, not
hidden — see `lib/webhooks/dispatcher.ts`).

**Scope:** `MANAGE_WEBHOOKS`. **Auth:** `allowSessionAuth`.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/webhooks` | List your webhooks |
| `POST /api/v1/webhooks` | Create one. `idempotent: true` |
| `GET /api/v1/webhooks/:id` | Detail + delivery history |
| `DELETE /api/v1/webhooks/:id` | Delete |
| `POST /api/v1/webhooks/:id/test` | Queue a synthetic test event |

## Event types

`token.risk_changed`, `token.insider_detected`, `token.liquidity_changed`,
`token.exitability_dropped`, `wallet.activity`, `launch.created`,
`launch.graduated`, `order.filled`, `order.failed`. Only
`token.exitability_dropped`/`token.liquidity_changed`/`token.risk_changed`
are actually fired by anything today — see [`alerts.md`](./alerts.md).

## Create a webhook

```bash
curl -X POST https://your-host/api/v1/webhooks \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"url": "https://you.example.com/hooks/sentinel", "eventTypes": ["token.exitability_dropped"]}'
```

The response includes a `secret` (`whsec_...`) shown **exactly once** —
store it now, it can't be retrieved again. You'll need it to verify
deliveries.

## Verifying a delivery

Every delivery POST carries:

| Header | Content |
|---|---|
| `X-Sentinel-Timestamp` | ISO timestamp |
| `X-Sentinel-Event-Id` | Unique event ID — track these to reject replays |
| `X-Sentinel-Signature` | `HMAC-SHA256(secret, "${timestamp}.${eventId}.${rawBody}")`, hex-encoded |

```js
const crypto = require('crypto');

function verify(secret, timestamp, eventId, rawBody, signature) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${eventId}.${rawBody}`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
```

Use `rawBody` — the exact bytes received, before any JSON parsing —
otherwise re-serialization can shift whitespace and break the signature
match.

## Retry behavior

A non-2xx response (or a timeout — 10s) schedules a retry at 1m, 5m, 30m,
then 2h, for up to 5 total attempts before the delivery is marked
`exhausted`. `GET /api/v1/webhooks/:id` shows each delivery's `status`,
`attempts`, `nextAttemptAt`, and `responseStatus` so you can debug a failing
endpoint.
