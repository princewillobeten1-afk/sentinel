# API routing plan — every feature to its endpoint

Audit date: 2026-08-20. Every view in `components/views/`, every store in
`lib/store/`, every hook in `lib/hooks/`, checked against the ~240 routes under
`app/api/`.

## How to read this

Each feature is one row: **what it is → where it gets data today → where it
should get data**. Status is one of:

| | meaning |
|---|---|
| **OK** | already routed to the right endpoint; no work |
| **WIRE** | endpoint exists, view ignores it — connect them |
| **BUILD** | no endpoint exists; must be built before wiring |
| **FIX** | wired, but to the wrong thing or with a defect |

The costly discovery from this audit: **the endpoints almost all exist.** Of 47
features below, 31 need only wiring, 9 are already correct, 5 have defects, and
just 2 need new backend. This is a connection job, not a build job.

---

## 1. Overview (`dashboard-view.tsx`) — `/terminal`, `activeView=dashboard`

Zero `fetch` calls. Everything is a hook or a literal.

| Feature | Today | Target | Status |
|---|---|---|---|
| Market sentiment gauge | `useMarketData().marketSummary` | `/api/v1/analytics/market` | FIX |
| Organic volume 24h | `marketSummary` (mock fallback) | `/api/v1/analytics/market` | FIX |
| Active threat alerts count | hardcoded | `/api/v1/alerts?severity=CRITICAL` count | WIRE |
| Portfolio net value | hardcoded | `/api/v1/portfolio/:wallet` | WIRE |
| Market Overview Tokens — Trending | `useMarketData().tokens` | `/api/v1/tokens/trending` | WIRE |
| Market Overview Tokens — Top | same | `/api/v1/tokens` (registry, sorted) | WIRE |
| Market Overview Tokens — Watchlist | `useWatchlist()` (localStorage) | `/api/v1/watchlist` | WIRE |
| Market Activity Stream chart | **literal bars** | `/api/v1/market/snapshots` | WIRE |
| Top Token Intelligence Rankings | hardcoded scores | `/api/v1/tokens/search` (ranked) | WIRE |
| Portfolio Allocation Preview | hardcoded 45/35/15/5 | `/api/v1/portfolio/:wallet/exposure` | WIRE |
| Risk Alerts Stream | `mockAlerts` literal | `/api/v1/alerts` | WIRE |
| Refresh Engine button | `refreshOverview()` (no-op) | re-fetch the above | FIX |
| Open Trade Terminal button | `setActiveView('trade')` | already routes | OK |

**`useMarketData` is the root defect here.** `lib/hooks/use-market-data.ts:23`
falls back to `mockMarketSummary` on error, then lines 27–32 **force
`freshness: 'fresh'`** with a current timestamp — so the green "fresh" chip is
guaranteed even when every upstream call has failed. `isLoading` (line 15) is
never set and `error` (line 58) is never populated. Fix this first; four Overview
features depend on it.

## 2. Trade (`app/trade/[chain]/[token]/page.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Token overview / price / mcap / liq / vol / holders | `fetchTokenOverview` (Birdeye) | keep; add `/api/v1/tokens/:chain/:address/market` fallback | FIX |
| Live price ticks | `useBirdeyeWS` | keep | OK |
| Candlestick chart | `/api/v1/tokens/:chain/:address/chart` | same | OK |
| Order placement | `/api/v1/orders` | same | OK |
| Quote | `/api/v1/trading/quote` | same | OK |
| Trading panel quote | **`quoteRouter` mock in-browser** | `/api/v1/trading/quote` | FIX |
| Trades tab | `/api/v1/tokens/:chain/:address/trades` | same | OK |
| Dev activity tab | `/api/v1/tokens/:chain/:address/dev-activity` | same | OK |
| Bubble map tab | `/api/v1/tokens/:chain/:address/bubble-map` | same | OK |
| Liquidity tab | `/api/v1/tokens/:chain/:address/liquidity` | same | OK |
| Holders tab | `/api/v1/tokens/:chain/:address/holders` | same | OK |
| Top traders tab | `/api/v1/tokens/:chain/:address/top-traders` | same | OK |
| Positions tab | hardcoded `1` | `/api/v1/portfolio/:wallet/positions` | WIRE |
| Orders tab | hardcoded `0` | `/api/v1/orders/open` | WIRE |
| Instant trade | `/api/v1/trading/instant` | same | OK |
| Watchlist toggle | local `useState` | `/api/v1/watchlist` POST/DELETE | WIRE |
| Limit order builder | `/api/v1/limit-orders` | same | OK |
| Position protection modal | `/api/v1/positions/:id/protection` | same | OK |

`lib/quote/router.ts` is documented in its own header as a prototype mock and is
imported directly into a client component (`trading-panel.tsx:10`), so it runs in
the browser with hardcoded rates. The server route already exists.

## 3. Discover (`discover-view.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Column feeds (new/trending/migrating/graduated) | `/api/v1/discovery/:section` | same | OK |
| Live updates | WebSocket `/ws` | same | OK |
| Search | client filter over loaded rows | `/api/v1/tokens/search` | WIRE |
| Advanced filters | client-side | pass to `/api/v1/discovery/screen` | WIRE |
| Filter presets | `lib/discovery/filter-presets` local | `/api/v1/user/preferences` | WIRE |
| Column config persistence | `localStorage` | `/api/v1/user/preferences` | WIRE |
| Quick-buy presets | `localStorage` | `/api/v1/user/preferences` | WIRE |
| Token card → trade | router push | already routes | OK |

## 4. Portfolio (`portfolio-view.tsx`, `portfolio-risk-center.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Overview / positions | `/api/v1/portfolio/:wallet` + `/positions` | same | OK |
| Risk centre | `/api/v1/portfolio/:wallet/risk` | same | OK |
| Exposure breakdown | not rendered | `/api/v1/portfolio/:wallet/exposure` | WIRE |
| Performance history | not rendered | `/api/v1/portfolio/:wallet/performance` | WIRE |
| P&L detail | not rendered | `/api/v1/portfolio/:wallet/pnl` | WIRE |
| Position protection | `/api/v1/positions/:id/protection` | same | OK |
| Emergency exit | `/api/v1/positions/:id/emergency-exit` | same | OK |

## 5. Watchlist (`watchlist-view.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Watchlist contents | `watchlist-store` → **localStorage only** | `/api/v1/watchlist` | WIRE |
| Add / remove | localStorage | `/api/v1/watchlist` POST/DELETE | WIRE |
| Live prices for rows | none | `/api/v1/market/price` or WS | WIRE |

`lib/store/watchlist-store.tsx` makes **zero** API calls while
`app/api/v1/watchlist/route.ts` exists. The watchlist does not survive a browser
change or reach a second device.

## 6. Alerts (`alerts-view.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Event feed | `/api/v1/alerts` | same | OK |
| Mark read | `/api/v1/alerts/:id` PATCH | same | OK |
| Alert rules CRUD | not rendered | `/api/v1/alert-rules` (+ `/:id`) | WIRE |
| Notification channels | not rendered | `/api/v1/notification-preferences` | WIRE |

## 7. Intelligence (`intelligence-view.tsx`, `/intelligence/[chain]/[token]`)

Zero fetches. Uses `lib/mocks/intelligence` via `getMockReportInput`.

| Feature | Today | Target | Status |
|---|---|---|---|
| Token intelligence list | **mock generator** | `/api/v1/intelligence` | WIRE |
| Per-token report | mock | `/api/v1/intelligence/:chain/:token` | WIRE |
| Insider analysis | mock | `.../insiders` | WIRE |
| Liquidity analysis | mock | `.../liquidity` | WIRE |
| Contract audit | mock | `.../contract` | WIRE |
| Organic demand | mock | `.../organic` | WIRE |
| Activity timeline | mock | `.../timeline` | WIRE |
| Ownership clusters | mock | `/api/v1/ownership/:chain/:token/clusters` | WIRE |
| Exitability | mock | `/api/v1/exitability/:chain/:token` | WIRE |

## 8. Analytics (`analytics-view.tsx`)

Zero fetches.

| Feature | Today | Target | Status |
|---|---|---|---|
| Market analytics | hardcoded | `/api/v1/analytics/market` | WIRE |
| Token analytics | hardcoded | `/api/v1/analytics/token/:address` | WIRE |
| Wallet analytics | hardcoded | `/api/v1/analytics/wallet/:address` | WIRE |
| Creator analytics | hardcoded | `/api/v1/analytics/creator/:address` | WIRE |
| Trader analytics | hardcoded | `/api/v1/analytics/trader` | WIRE |
| Data quality | hardcoded | `/api/v1/analytics/quality` | WIRE |
| Backtest runner | `setBacktestRunning` local only | `/api/v1/analytics/backtest` | WIRE |

## 9. AI Co-Pilot (`ai-view.tsx`, 1052 lines)

Zero fetches — the largest fully-unwired view.

| Feature | Today | Target | Status |
|---|---|---|---|
| Copilot chat | hardcoded replies | `/api/v1/ai/copilot` | WIRE |
| Token analysis | hardcoded | `/api/v1/ai/analyze` | WIRE |
| Trade check | hardcoded | `/api/v1/ai/trade-check` | WIRE |
| What changed | hardcoded | `/api/v1/ai/what-changed` | WIRE |
| Feature extraction | hardcoded | `/api/v1/ai/features` | WIRE |
| Model evaluation | hardcoded | `/api/v1/ai/evaluation` | WIRE |

## 10. Launchpad (`launchpad-view.tsx`, `launch-*.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Launch discovery feed | `/api/v1/launches` | same | OK |
| Launch detail | `/api/v1/launches/:id` | same (route is a stub) | FIX |
| Launch intelligence | `/api/v1/launches/:id/intelligence` | same (stub returns 5 constants) | FIX |
| Launch simulate | `/api/v1/launches/:id/simulate` | same | OK |
| Create / analyze launch | `/api/v1/launches` POST | same | OK |
| Ownership breakdown | **no endpoint** | build `/api/v1/launches/:id/ownership` | BUILD |
| Launch analytics | **no endpoint** | build `/api/v1/launches/:id/analytics` | BUILD |

## 11. Admin (`admin-view.tsx`)

Uses in-process `adminIncidentService`, never the API. 22 admin endpoints exist.

| Feature | Today | Target | Status |
|---|---|---|---|
| Platform overview | in-process service | `/api/v1/admin/overview` | WIRE |
| User management | in-process | `/api/v1/admin/users` (+ `/:id`, `/role`) | WIRE |
| Abuse reports | `adminIncidentService.listAbuseReports()` | `/api/v1/admin/investigate` | WIRE |
| Audit log | in-process | `/api/v1/admin/audit-log` | WIRE |
| Kill switch | in-process | `/api/v1/admin/kill-switch` (+ request/approve/reject) | WIRE |
| Feature flags | in-process | `/api/v1/admin/feature-flags` | WIRE |
| Config | in-process | `/api/v1/admin/config` | WIRE |
| Treasury | in-process | `/api/v1/admin/treasury` | WIRE |
| Health / SLO | in-process | `/api/v1/admin/health`, `/api/v1/health/slo` | WIRE |
| Execution blocklist | in-process | `/api/v1/admin/execution/blocklist` | WIRE |
| Usage / latency | in-process | `/api/v1/admin/usage/latency` | WIRE |
| Export | in-process | `/api/v1/admin/export` | WIRE |

## 12. Copy trading (`copy-trading-view.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Smart wallet list | hardcoded | `/api/v1/smart-wallets` | WIRE |
| Copy profiles | hardcoded | `/api/v1/copy-profiles` | WIRE |
| Active strategies | hardcoded | `/api/v1/copy-strategies` | WIRE |
| Stop strategy | none | `/api/v1/copy-strategies/:id/stop` | WIRE |

## 13. Developers (`developer-dashboard-view.tsx`)

Children are already wired; the shell is not.

| Feature | Today | Target | Status |
|---|---|---|---|
| API keys list / create / rotate / revoke | `/api/v1/user/api-keys` | same | OK |
| Usage panel | `/api/v1/user/usage` | same | OK |
| Webhooks CRUD + test | `/api/v1/webhooks` | same | OK |

## 14. Settings (`settings-view.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Preferences | `/api/v1/user/preferences` | same | OK |
| Interface scale | localStorage | keep local (device-specific) | OK |
| Theme / density | store only | `/api/v1/user/preferences` | WIRE |
| Sessions list / revoke | `/api/v1/auth/sessions` | same | OK |
| Password change | `/api/v1/auth/change-password` | same | OK |
| Account deletion | `/api/v1/users/me` DELETE | same | OK |
| Notification prefs | not rendered | `/api/v1/notification-preferences` | WIRE |

## 15. Wallet (`wallet-management-view.tsx`, `wallet-modal.tsx`)

| Feature | Today | Target | Status |
|---|---|---|---|
| Connect / SIWS | `/api/v1/auth/challenge` → `/api/v1/wallets/connect/verify` | same | OK |
| Linked wallets | `/api/v1/wallets` | same | OK |
| Set primary | `/api/v1/wallets/:id/default` | same | OK |
| Unlink | `/api/v1/wallets/:id` DELETE | same | OK |
| Balance | `/api/v1/user/wallets/:id/balance` | same | OK |
| Transactions | `/api/v1/user/wallets/transactions` | same | OK |
| Deposit / withdraw | `/api/v1/wallets/deposit`, `/withdraw` | same | OK |
| Transaction simulate | `/api/wallets/simulate` (unversioned) | `/api/v1/orders/simulate` | FIX |

## 16. Cross-cutting stores

| Store | Today | Target | Status |
|---|---|---|---|
| `watchlist-store` | localStorage | `/api/v1/watchlist` | WIRE |
| `trade-history-store` | in-memory | `/api/v1/trading/history` | WIRE |
| `notifications-store` | in-memory | `/api/v1/notification-preferences` | WIRE |
| `preferences-store` | `/api/v1/user/preferences` | same | OK |
| `wallet-store` | 13 real calls | same | OK |
| `ui-store` | localStorage | keep local | OK |

---

## Execution order

Sequenced so each stage unblocks the next, highest user-visible impact first.

**Stage 1 — fix the lying layer (2 items, blocks 4 Overview features)**
`use-market-data.ts` must stop forcing `freshness: 'fresh'` on failure and must
populate `isLoading`/`error`. Then point it at `/api/v1/analytics/market`.

**Stage 2 — persistence that already has endpoints (3 stores)**
Watchlist, trade history, notification preferences. Small, self-contained, and
each fixes data silently lost today.

**Stage 3 — Overview page (11 features)**
The default landing screen. Everything it needs exists.

**Stage 4 — fully-unwired views, largest value first**
Intelligence (9) → Analytics (7) → AI Co-Pilot (6) → Copy trading (4).

**Stage 5 — Admin (12 features)**
Self-contained, lower traffic, but the in-process service means admin actions do
not persist or audit correctly today.

**Stage 6 — gaps and defects**
Trading panel off the browser-side mock quote; wallet simulate onto v1; launch
detail/intelligence stubs made real; then **BUILD** the two launch endpoints.

## Conventions for every wiring change

1. Use `endpoints` + `apiUrl` from `lib/api/endpoints.ts`. Never a literal URL.
2. Unwrap with `readApiData` from `lib/api/response.ts` — every v1 route returns
   `{success, data}` and reading the payload directly yields `undefined`.
3. Send `credentials: 'include'`; auth is the `sentinel_session` cookie.
4. Three states minimum: loading, empty, error-with-retry. An error must never
   render as a loading state or as zeros.
5. Unknown values render `—`, never `0` and never a fabricated default.
6. Add the endpoint to `lib/api/endpoints.ts` if missing, and confirm the route
   file exists before wiring.

## Token catalog: why the Overview shows so few tokens

The Overview's token tabs are capped at 20 (Trending) and 15 (Top Tokens), but
render 3 and 5. The cap is not the constraint — the catalog is. Three separate
sources feed these panels, and each is short for a different reason:

| Panel | Reads | Holds today | Why |
|---|---|---|---|
| Trending Tokens | `rankingEngine` → `tokenDiscoveryPipeline` | **3** | An in-memory `seedDefaults()` of four hardcoded tokens, three ACTIVE. Not the database. Two of its ids (`3mA1...4c90`, `9pW2...8b11`) are truncated display strings, not mint addresses. |
| Top Tokens | `tokens` table via `/api/v1/tokens` | **5** | The real registry, genuinely holding five rows. |
| — | `realtime_tokens` | 930 rows, no market data | Every row is a `MockToken…` placeholder written by `MOCK_REALTIME=true`, not a Helius discovery. |

Every `*_snapshots`, `markets` and `liquidity_*` table is empty, so the prices
those panels display today come from `snapshotEngine.seedDefaultSnapshots()` —
which is why USDC renders at ~$150 alongside SOL.

### The backfill

`db/backfill-token-enrichment.js` (`npm run db:backfill`) fills market data from
Birdeye and promotes qualifying tokens into the registry. Migration
`030_token_enrichment_backfill.sql` adds the columns it needs: `price_change_24h`
plus `enriched_at` / `enrichment_status` / `enrichment_error` / `promoted_token_id`
for provenance and resumability.

- **Batched** — `/defi/multi_price` and `/defi/price_volume/multi` take up to 100
  mints per request, so 930 tokens cost ~38 requests, not 1,860.
- **Quota-aware** — exhaustion arrives as HTTP **200** with `success:false`, not
  a 429, so it is detected by message; the run then stops and exits 3 with
  progress saved rather than grinding through identical failures.
- **Address-screened** — invalid mints are rejected locally, before any request.
  This alone spares the whole current table: all 930 rows fail base58 validation.
- **Honest** — a token with no price becomes `NO_MARKET` with NULL, never a zero.

`/api/v1/tokens` now LEFT JOINs the enrichment columns and accepts
`sort=volume|liquidity|symbol` (whitelisted). The Overview requests
`sort=volume`, since "Top Tokens" ordered alphabetically is not a ranking.

**The backfill cannot produce real tokens until real ingestion runs.** Its input
is 930 mock mints; pointing it at them would correctly mark every one
`NO_MARKET`. What it needs first is genuine Helius discovery
(`MARKET_STREAM_ENABLED=true`, `MOCK_REALTIME` off) and a Birdeye quota.
Trending additionally needs `tokenDiscoveryPipeline` moved off its in-memory
seed onto the `tokens` table — the backfill does not address that path.
