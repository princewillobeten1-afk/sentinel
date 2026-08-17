# @sentinel/sdk

Official TypeScript SDK for the Project Sentinel API (Sprint 28). Standalone
package, not published to a registry yet — install it from this path within
the monorepo or copy it out when publishing becomes in scope.

## Install

```bash
cd sdk/typescript
npm install
npm run build
```

## Usage

```ts
import { SentinelClient } from '@sentinel/sdk';

const client = new SentinelClient({
  apiKey: process.env.SENTINEL_API_KEY!, // sk_live_... or sk_sandbox_...
  baseUrl: 'https://api.sentinel.dev',   // or http://localhost:3000 locally
});

const report = await client.intelligence.get('solana', 'SENT');
console.log(report.overallScore, report.riskLevel);

const exitability = await client.exitability.get('solana', 'SENT', { amount: 5000 });
console.log(exitability.score, exitability.interpretation);
```

### Resources

| Resource | Scope required | Notes |
|---|---|---|
| `client.intelligence` | `READ_TOKEN_INTELLIGENCE` | Also works unauthenticated |
| `client.exitability` | `READ_TOKEN_INTELLIGENCE` | Also works unauthenticated |
| `client.ownership` | `READ_REPUTATION` | Also works unauthenticated |
| `client.creator` | `READ_REPUTATION` | Also works unauthenticated |
| `client.discovery` | `READ_MARKET_DATA` | `watchlist()` requires real auth |
| `client.portfolio` | `READ_PORTFOLIO` | 403s for a wallet you don't own |
| `client.execution` | `TRADE` (dangerous, never auto-granted) | Simulated fills — see `docs/api/execution.md` |
| `client.launches` | `CREATE_LAUNCH` for `analyze`/`deploy` | Reads work unauthenticated |
| `client.webhooks` | `MANAGE_WEBHOOKS` | Secret shown once on `create()` |

### Errors

```ts
import { SentinelApiError, SentinelNetworkError } from '@sentinel/sdk';

try {
  await client.execution.submit(quote, request);
} catch (err) {
  if (err instanceof SentinelApiError) {
    console.error(err.status, err.code, err.message); // e.g. 403 INSUFFICIENT_SCOPE
  } else if (err instanceof SentinelNetworkError) {
    console.error('network problem:', err.message);
  }
}
```

### Rate limits

Every response's rate-limit headroom is available after each call:

```ts
await client.discovery.trending();
console.log(client.lastResponseMeta?.rateLimit); // { limit, remaining, reset }
```

### Idempotent writes

Pass `idempotencyKey` to any write method to make a retried call safe:

```ts
await client.webhooks.create(url, ['token.exitability_dropped'], 'my-idempotency-key-1');
```

### Streaming

```ts
import { SentinelStream } from '@sentinel/sdk';

const stream = new SentinelStream({ apiKey, baseUrl: 'http://localhost:3000' });
await stream.connect();

stream.on('token.price:So11111111111111111111111111111111111111112', (event) => {
  console.log(event.sequence, event.data);
});
stream.subscribe(['token.price:So11111111111111111111111111111111111111112']);
```

In Node, install `ws` alongside this package (it's an optional peer
dependency) or pass `WebSocketImpl` explicitly. Browsers use the native
`WebSocket` automatically.

## What's real vs. simulated

This SDK talks to a real API gateway (auth, scopes, rate limiting,
idempotency, webhook delivery are all genuinely enforced server-side — see
`lib/server/api-gateway.ts`). `client.execution` and `client.launches`'
`deploy()` call into a **simulated** fill/deployment engine, not a live DEX or
chain — the gateway around them is real, the trade/deploy outcome is not. See
`docs/api/execution.md` and `docs/api/launches.md`.
