# Benchmarks

**Single dev-mode process, one machine — not a proxy for production/scale
behavior.** No load balancer, no autoscaling, no multi-region, `MARKET_STREAM_ENABLED=false`
locally (see `lib/market/live/stream-manager.ts`). These numbers describe
this one `node server.js` process on this one machine at this one moment,
nothing more. See [`out-of-scope.md`](./out-of-scope.md) for what real
load/stress testing would actually require.

## Method

`scripts/benchmark.mjs` — 30 requests per endpoint, concurrency 5, against a
locally running `node server.js`. Latency percentiles use the same
nearest-rank method as `lib/server/usage-log.ts#computePercentiles` (real
cross-item reuse from Item 5, reimplemented inline since this script is
plain Node with no TypeScript build step, matching `scan-secrets.mjs`'s and
`check-bundle-size.mjs`'s existing self-contained style).

```bash
node server.js &
node scripts/benchmark.mjs
```

## Results

Captured 2026-08-15, warm dev-server cache, `MARKET_STREAM_ENABLED=false`:

| Endpoint | p50 | p95 | p99 | req/s | errors |
|---|---|---|---|---|---|
| `/api/v1/discovery/trending?limit=20` | 50ms | 2595ms | 2634ms | 10.4 | 0/30 |
| `/api/v1/discovery/liquidity?limit=20` | 45ms | 1200ms | 2021ms | 10.6 | 10/30 |
| `/api/v1/discovery/new?limit=20` | 29ms | 749ms | 1095ms | 19.7 | 12/30 |
| `/api/v1/tokens/solana/SENT/chart?timeframe=15m&limit=100` | 62ms | 496ms | 497ms | 36.5 | 0/30 |
| `/api/v1/tokens/solana/SENT/chart?timeframe=15m&limit=100&before=…` | 57ms | 73ms | 73ms | 84.8 | 0/30 |
| `/api/v1/market/live/summary` | 5327ms | 5640ms | 5645ms | 0.9 | 22/30 |
| `/api/v1/discovery/watchlist?limit=20` | 37ms | 260ms | 260ms | 68.9 | 0/30 |
| `/api/v1/user/usage` | 40ms | 139ms | 139ms | 88.3 | 0/30 |

## Reading these honestly

- **The chart routes (Item 12) and `user/usage`/`watchlist` (in-process,
  cached, or purely local computation) are fast and error-free** — p50 well
  under 100ms, req/s in the 35–90 range even at only 5-way concurrency.
  `chart:load-older`'s p50/p95/p99 all sit near 60-70ms because it's the
  same deterministic, stateless generator on every call — no cold-cache
  penalty exists to pay.
- **`discovery/trending`'s p95/p99 (2.6s) and `discovery/liquidity`'s 10
  errors out of 30 are real, and are the same pre-existing Birdeye API
  issue flagged in [`README.md`](./README.md)'s "gaps found, not fixed"
  section** — not something this sprint's caching introduced. A cache MISS
  still has to wait on the live Birdeye call underneath it, and this
  environment's Birdeye key hits real rate limits (`429`) and, for
  `movers`/`momentum`/`volume`, real `400`/`401`s under sustained
  concurrent benchmark load.
- **`market/live/summary`'s ~5.3s p50 and 22/30 errors are the standout bad
  number here**, and it's real: this route degrades through several
  sequential live Birdeye lookups (see `lib/market/solana-provider.ts`) with
  no caching layer of its own — out of this sprint's explicit scope (Item 1
  only covered the 6 previously-uncached *discovery* routes), but worth
  flagging plainly rather than omitting an inconvenient number. A reasonable
  next-sprint candidate for the same `external-feed-cache.ts` treatment.
- Every number above reflects **one process serving both the benchmark
  script's traffic and its own internal work** (webhook dispatcher polling,
  WS heartbeat/drain loops) — concurrency 5 is "modest" deliberately: enough
  to observe real queuing/backpressure behavior without pretending it's a
  load test.
