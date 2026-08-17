# WebSocket streaming

A real WebSocket server (`lib/ws/**`), not a polling shim — it runs inside
the same custom `server.js` entrypoint that hosts the REST API, bridging
the same event bus (`SignalProcessor`) the web app itself uses.

## Connecting

```
ws://your-host/ws?apiKey=sk_live_...
```

Auth is verified through the exact same `apiKeyStore.verify()` the REST
gateway uses — no separate WS-only credential path. A connection with no
key, or an invalid one, closes immediately with code `4401`.

You can also authenticate via the `Sec-WebSocket-Protocol` header instead of
a query param, if you'd rather not put the key in a URL that might get
logged somewhere.

## Protocol

Client → server:

```json
{ "type": "subscribe", "topics": ["token.price:So1111...11112"] }
{ "type": "unsubscribe", "topics": ["token.price:So1111...11112"] }
{ "type": "ping" }
```

Server → client:

```json
{ "type": "welcome", "connectionId": "...", "maxSubscriptions": 50 }
{ "type": "subscribed", "topics": [...] }
{ "type": "event", "topic": "token.price:So1111...11112", "sequence": 42, "data": {...}, "ts": "..." }
{ "type": "pong" }
{ "type": "error", "code": "...", "message": "..." }
```

`sequence` is a monotonic counter **per topic, per connection** (changed in
Sprint 31 — previously it was monotonic across everything a connection
received). Two different topics on the same connection each start their own
count at 1; compare `sequence` only within the same `topic` to detect a
dropped event.

## Connection hygiene

- **Heartbeat**: the server pings every connection every 30s at the protocol
  level (distinct from the `{"type":"ping"}` JSON message above, which is an
  app-level echo you can use for your own liveness checks). A connection
  that doesn't `pong` back within one cycle is terminated — a dead
  connection is reaped within roughly a minute.
- **Message rate limit**: 30 client messages per 10s per connection. Over
  that, messages are dropped with an `{"type":"error","code":"MESSAGE_RATE_LIMITED"}`
  response; sustained abuse (3x the limit within one window) closes the
  connection with code `4429`.
- **Backpressure**: if your connection's outbound buffer backs up (e.g. a
  slow client), the server coalesces `event` messages per topic —
  last-value-wins — instead of queueing every intermediate update
  unboundedly. Control-plane messages (`welcome`/`subscribed`/`error`/`pong`)
  are never coalesced or dropped.

## Topics

`namespace.event:target`, e.g. `token.price:<mint>`.

| Topic kind | Requires scope |
|---|---|
| `token.price` | `READ_MARKET_DATA` |
| `token.trade` | `READ_MARKET_DATA` |
| `token.risk` | `READ_TOKEN_INTELLIGENCE` |

Subscribing to a topic your key isn't scoped for gets an `error` message,
not a silent drop. On subscribe, you immediately get a cached snapshot for
that topic (if one exists) before any live events, so you're never staring
at an empty screen waiting for the next tick.

## Subscription caps

Bounded per connection by your API key's rate-limit tier (same tiers as
REST — see the [README](./README.md#rate-limits)).

## Example (Node, using the SDK)

```ts
import { SentinelStream } from '@sentinel/sdk';

const stream = new SentinelStream({ apiKey, baseUrl: 'http://localhost:3000' });
await stream.connect();
stream.on('token.price:So11111111111111111111111111111111111111112', (event) => {
  console.log(event.sequence, event.data);
});
stream.subscribe(['token.price:So11111111111111111111111111111111111111112']);
```
