# Explicitly Out of Scope

Per the source spec's 106 sections, these require infrastructure this
codebase doesn't have or engagement this sprint doesn't provide — building
fake versions of them would be decorative, not real. Listed here so the gap
is visible, not silently absent (same discipline as
[`docs/security/out-of-scope.md`](../security/out-of-scope.md)).

| Item | Why it's out of scope this sprint |
|---|---|
| **Kafka / Redpanda / NATS event streaming** | No message broker exists or is deployed. `lib/ws/broadcaster.ts` bridges the existing in-process `SignalProcessor` event bus directly to WebSocket fan-out — correct for one process, but there's no durable/replayable stream, no multi-consumer-group semantics, and nothing to fail over to if this one process restarts. |
| **ClickHouse / a real time-series analytics store** | No analytics database exists. Historical data (candles, usage logs) lives in in-memory arrays with a fixed retention cap (`lib/server/usage-log.ts`'s `MAX_ENTRIES`), not a queryable columnar store. |
| **Redis (or any shared cache)** | The in-process caches added this sprint (`lib/discovery/external-feed-cache.ts`, `lib/discovery/ranking-cache.ts`) are correct for one process but can't share state across instances that don't exist yet — there's no horizontal scaling to make a shared cache meaningful. |
| **CDN** | Everything is served directly by the one `node server.js` process; no edge/CDN layer sits in front of it. Static asset caching is whatever Next.js's own dev/production build does by default. |
| **Multi-region infrastructure** | Same as Sprint 30's finding, unchanged: single process, no cloud deployment target. |
| **Autoscaling / load balancing** | No orchestration layer (Kubernetes, ECS, etc.) exists to scale against. There is exactly one process to route traffic to. |
| **Real load / stress / spike / soak testing at 1k–100k-user concurrency** | `scripts/benchmark.mjs` (see [`benchmarks.md`](./benchmarks.md)) intentionally runs at concurrency 5, one process, one machine — a real load test at meaningful concurrency would need actual scaled-out infrastructure to be testing anything other than this one machine's ceiling, and would risk taking down the only environment this app runs in. |
| **Chaos testing (killing nodes, network partition injection, etc.)** | There's exactly one node. Killing it doesn't test failover — there's nothing to fail over to. Meaningful chaos testing needs the multi-instance infrastructure above to exist first. |
| **RPC redundancy / failover for Solana RPC calls** | Unchanged from Sprint 30's finding — `env.SOLANA_RPC_URL` is still a single configured endpoint with no fallback provider. A real reliability gap, not addressed by this sprint's caching/timeout work (Item 2 added timeouts to Birdeye HTTP calls specifically, not the Solana RPC path). |
| **Unifying the two parallel Birdeye HTTP clients** (`lib/api/birdeye/client.ts`, `lib/market/birdeye-rest-client.ts`) | Both independently needed the Item 2 timeout treatment and both got it, but merging them into one client is a real, separate refactor (an 18-file blast radius on the older of the two) deliberately not attempted alongside everything else this sprint — flagged instead of silently merged or silently left inconsistent. |
| **A real live-tick price source for the candlestick chart** | `components/trading/candlestick-chart.tsx` no longer fakes a live tick (Item 12 removed the old `setInterval` random-noise nudge entirely, on principle — a fake tick is worse than no tick), but building a real one needs an actual streaming price source wired to a chart-specific WS topic scoped to "the one token this chart is showing," which doesn't exist yet. The chart is real, paginated, historical data; it just doesn't move on its own between requests. |
| **Caching `market/live/summary` and the other non-discovery live-data routes** | Item 1's caching pass covered the 6 discovery routes recon found uncached; `market/live/summary` (see [`benchmarks.md`](./benchmarks.md)'s ~5.3s p50 finding) and similar routes elsewhere in `lib/market/**` were out of this sprint's stated scope and are a reasonable next-sprint candidate, not silently assumed fine. |

## A note on scope discipline

Every item above was deliberately left out, not overlooked. Where a
cheaper, honest partial version was buildable (in-process caching instead
of Redis, a real deterministic chart generator instead of Kafka-fed
candles, a concurrency-5 local benchmark instead of a claimed "load test"),
it was built. Where nothing honest could be built without infrastructure
that doesn't exist, it's listed here instead of faked.
