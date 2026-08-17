# Project Sentinel Performance

Sprint 31's performance foundation: real, working improvements for
everything genuinely buildable given this app's actual architecture (a
single Node process running `node server.js`, in-memory `globalThis`-guarded
stores, no real database, no cloud infrastructure), plus honest
documentation for everything that needs infrastructure this sprint doesn't
provide.

This mirrors [`docs/security/README.md`](../security/README.md)'s framing:
**deep core, honest about the rest**, not a shallow pass over all 106
sections of the source spec.

## What's real

| Area | Status | Where |
|---|---|---|
| Backend caching for previously-uncached discovery routes | **Real** | `lib/discovery/external-feed-cache.ts` — 30s TTL, wired into all 6 of `trending`/`momentum`/`new`/`volume`/`liquidity`/`movers`, `X-Cache: HIT\|MISS` debug header |
| Outbound HTTP timeouts on Birdeye clients | **Real** | `lib/api/birdeye/http-timeout.ts` — 8s `AbortController`-based timeout, wired into both Birdeye HTTP clients; unit-tested against a real never-responding local server, not just a mock |
| Cursor pagination | **Real** | `lib/discovery/cursor.ts` — opaque, filter-fingerprinted cursors on all 7 discovery list routes + `screen`; additive, existing offset/limit-only callers unaffected |
| `getPositionById` N+1 fix | **Real** | `lib/portfolio/service.ts` — at most one `computePortfolio()` call per distinct portfolio the caller can access, not one per wallet |
| Latency observability (p50/p95/p99) | **Real** | `lib/server/usage-log.ts#computePercentiles`, surfaced on `GET /api/v1/user/usage` and the new admin-only `GET /api/v1/admin/usage/latency` |
| WebSocket heartbeat + dead-connection reaping | **Real** | `lib/ws/server.ts` — protocol-level ping/pong every 30s, terminates a connection that doesn't `pong` back |
| WebSocket per-connection message-rate limiting | **Real** | `lib/ws/connection-policy.ts#checkMessageRate` — 30 msgs/10s, sustained abuse (3x) closes the connection (code `4429`) |
| WebSocket per-topic sequence numbers | **Real, protocol change** | `sequence` is now monotonic per-topic-per-connection, not per-connection-global — see [`../api/websocket.md`](../api/websocket.md) |
| WebSocket send-side backpressure | **Real** | coalesces (last-value-wins) `event` messages per topic once `socket.bufferedAmount` exceeds 1MB, instead of an unbounded send queue |
| Frontend real-time discovery feed | **Real** | `lib/hooks/use-discovery-ws.ts` — session-cookie-authenticated WS connection layered on top of the existing 15s poll, which stays the always-working fallback |
| Frontend code-splitting | **Real** | 14 view components converted to `next/dynamic` (13 in `components/dashboard/dashboard-shell.tsx`'s tab switcher + `wallet-management-view` in `settings-view.tsx`) — see the note on unused views below |
| List virtualization | **Real** | `@tanstack/react-virtual` in `components/discovery/discovery-table.tsx` (display:grid/flex CSS restructure) and `components/discovery/virtualized-mobile-grid.tsx`; the table's live-price WS subscription is also narrowed to only the currently-visible rows |
| Search debouncing | **Real** | `lib/hooks/use-debounce.ts`, wired into `discover-view.tsx` — the search input stays instant, only the fetch trigger is debounced (300ms) |
| Real progressive chart data | **Real** | `lib/market/mock-ohlcv.ts` — deterministic, closed-form-per-index OHLCV generator (not a continuously-advanced walk, so any arbitrary older page is independently regenerable with no cache); `GET /api/v1/tokens/:chain/:address/chart` is a real paginated route; `candlestick-chart.tsx` fetches real data and loads older candles on scroll — see [`benchmarks.md`](./benchmarks.md) for what's still simulated |
| CI bundle-size regression gate | **Real, blocking from day one** | `scripts/check-bundle-size.mjs` — 300KB absolute ceiling per route + 15% regression vs. `scripts/bundle-size-baseline.json`, wired into `.github/workflows/ci.yml` right after the build step |

## Real bugs found and fixed along the way

Not pre-planned sprint items — found while verifying the above live, and fixed at the root rather than worked around, matching this project's established practice (see `docs/security/README.md`'s equivalent section from Sprint 30):

- **`lib/server/usage-log.ts`'s `entries` array wasn't `globalThis`-guarded**, unlike every other in-memory store in this codebase. In Next.js dev mode, different API routes can get their own compiled instance of a module, silently splitting usage/latency history per-route-bundle instead of tracking it platform-wide — found while live-verifying Item 5's platform-wide percentiles (a route's own count kept resetting to what looked like zero). Fixed with the same `globalThis` guard `lib/server/store.ts`/`api-keys.ts` already use.
- **`lib/ws/server.ts`'s `connections` Map had the identical gap** — found the same way, this time via a new dev-only diagnostic route (`/api/internal/ws-test-broadcast`, kept as a permanent tool since `MARKET_STREAM_ENABLED=false` is routinely set locally and this is otherwise the only way to exercise WS fan-out without real market data).
- **`lib/server/nfr/health.ts` and `lib/server/nfr/quality-gates.ts` had real compile errors** (`isKillSwitchActive` was never exported from `kill-switch.ts`; a `serviceId: string` indexed a `Record<ServiceName, ...>` without a cast) that a stale `tsconfig.json` `incremental: true` build-info cache had been silently hiding all session — surfaced once a clean `node_modules` reinstall (unrelated, done to add this sprint's new devDependencies) invalidated that cache. Both are pre-existing, unrelated to this sprint's actual scope (`lib/server/nfr/**` is scaffolding for a not-yet-built future sprint), fixed because they were blocking a clean build/typecheck, not expanded further.
- **A dead `DashboardShell` import in `app/trade/[chain]/[token]/page.tsx`** (never rendered in that file's JSX) was pulling the code-split `dashboard-shell.tsx`'s nested `next/dynamic()` module graph into that page's static-export bundle, which triggered a Next.js 14.2.5 static-export RSC serialization crash (`TypeError: e[o] is not a function`) specific to `/trade`. Removed the dead import — zero functional impact, fixes the crash.
- **`landing-view.tsx`'s framer-motion `Variants` object literals weren't typed as `Variants`**, so `transition.type: 'spring'` silently widened to `string` and failed the `motion.div`'s `variants` prop's structural check — also hidden by the same stale build-info cache. Added explicit `Variants` annotations.

## A note on two pre-existing, honestly-scoped gaps found (not fixed)

- **`movers`/`momentum`/`volume` discovery routes return live Birdeye `400`/`401` errors** under this environment's API key/tier — pre-existing, confirmed unrelated to this sprint's caching work (errors reproduce identically with or without the cache, and are never themselves cached — only successful responses are). `movers`'s code already carried a comment doubting its `sort_by` value was valid; `momentum`'s smart-money endpoint likely isn't enabled for this key's tier. Needs checking against Birdeye's actual current API contract, not something to guess-fix blind.
- **11 of the 26 `components/views/*.tsx` files are unreferenced dead code** (`alert-inbox.tsx`, `copy-trading-view.tsx`, `trader-profile-view.tsx`, `alert-center-view.tsx`, `alert-story-view.tsx`, `execution-preview.tsx`, `launch-wizard.tsx`, `launch-dashboard.tsx`, `launch-discovery.tsx`, `reputation-profile.tsx`, `trust-graph.tsx`) — found while scoping Item 8's code-splitting (only mounted views were worth splitting). Left in place rather than deleted, since removing built-but-unwired features is a product decision, not a performance one. **Update, Sprint 36**: a second, separate dead pair was found in `components/views/launchpad/` (`launch-token-view.tsx`, `launch-wizard.tsx` — note the name collision with the flat `launch-wizard.tsx` above, a different file) — these called an equally-dead, non-`v1`, unauthenticated API route tree (`app/api/launches/**`) that Sprint 36 deleted outright rather than leave inconsistent with the real `app/api/v1/launches/**` tree, since it also carried a second, conflicting launch-state-machine vocabulary. See `docs/contracts/03-launchpad-and-launch-controller.md`.

## What's documentation, not implementation

| Doc | Covers |
|---|---|
| [`benchmarks.md`](./benchmarks.md) | Real local latency/throughput numbers from `scripts/benchmark.mjs`, honestly labeled as single-process/single-machine |
| [`out-of-scope.md`](./out-of-scope.md) | Kafka/Redpanda/NATS, ClickHouse, Redis, CDN, multi-region, autoscaling, real load/stress/chaos testing — and why each needs infrastructure this sprint doesn't build |

## Verification

Every real item above was both unit-tested (`lib/**/__tests__/**/*.test.ts`,
house Vitest convention, no mocking framework) **and** exercised live
against a running `node server.js` — not just typechecked. Notably: cache
`X-Cache: HIT`→`MISS` flips confirmed via repeated `curl`; a real
never-responding local HTTP server proving the outbound timeout actually
aborts; cursor round-trip/tamper-rejection/cross-section-mismatch all
confirmed via live pagination; ~30 real requests confirming
`p50 ≤ p95 ≤ p99`; a small ad-hoc WS client script confirming per-topic
sequencing, message-rate-limit termination, and heartbeat pings surviving a
real ~30s idle wait; a `next build` confirming code-splitting actually
produced separate chunks and the bundle-size gate's parser matches the
build's own printed figures exactly.

**One consistent limitation**: this environment has no browser automation
tool available, so frontend-only behavior — the WS discovery feed actually
connecting from real browser JS, the debounced search collapsing keystrokes
in a real input, virtualized DOM node counts staying bounded while
scrolling, the chart's canvas actually rendering and its scroll-triggered
load-older firing — was verified via typecheck, a clean production build,
server-side rendering with no errors, and code review, but not driven in an
actual browser. Flagged explicitly rather than claimed as fully verified.
