# Real trading chart integration

## Implemented

- The chart API reads Birdeye V3 OHLCV in USD, with unpadded candles and base-token volume. Credentials stay on the server. Generated candle history and random browser price ticks are removed from the active chart paths.
- Main Trade, dashboard Trade, and the legacy token-page chart share the same component. A pool/market ID is never substituted for a token mint.
- History requests are deduplicated, bounded, cached, and paced through the shared Birdeye rate limiter. Timeouts, access failures, malformed payloads, and rate limits are visible. Previously measured history can remain visible as stale data; an empty response stays empty.
- Selected-interval candles flow through the existing Birdeye connection, a full-set subscription query, and `token.ohlcv:<mint>:<timeframe>`. The server reference-counts chart demand and replays the latest cached frame. Subscription authentication and limits remain unchanged.
- The browser reconciles through REST every 10 seconds when polling, or every 30 seconds while receiving recent WebSocket candles. Hidden pages pause polling. Reconnection triggers reconciliation. Polling cadence is a target, not a provider-latency guarantee.
- Full candle revisions replace cumulative volume instead of adding it twice. Older observations cannot overwrite newer revisions. Older loaded pages survive refreshes, and token/timeframe changes cancel obsolete requests.
- Real volume bars, small-price axis formatting, pan/zoom, older-history loading, accessible timeframe controls, retry, and loading/empty/stale states are wired. Resizing does not initiate historical downloads. Error overlays remain clickable above the canvas.

## Provider access still needs attention

Read-only check on 2026-09-23:

- Birdeye V3 1-minute and 15-minute OHLCV: HTTP 200 with real SOL candles.
- Birdeye WebSocket: transport opens, but the subscription is rejected with an origin/API-key error. No live provider candle was received.

The chart therefore works with real polling data now. The WebSocket path has fixture coverage but is **not verified against a successful live Birdeye subscription**. Check the configured key's WebSocket permissions/plan and allowed-origin configuration with Birdeye. Do not expose the key in browser code or commit it. After provider access is corrected, rerun `node scripts/chart-provider-smoke.cjs` and confirm actual `PRICE_DATA` frames, then verify a signed-in app session shows **Live**.

The existing authenticated WebSocket gateway and custom server must be running with market streaming enabled. A socket connection alone never earns the Live label; the chart requires a recent valid candle. Polling uses the existing public read-only chart endpoint.

## Verification

- The app's chart endpoint returned HTTP 200 and five genuine 15-minute SOL candles (2026-09-22).
- `node scripts/chart-provider-smoke.cjs`: redacted provider capability evidence in `artifacts/real-chart/provider-smoke.json`.
- `node scripts/real-chart-qa.cjs`: browser fixture checks pass at 1440×900, 1280×800, 768×1024, and 390×844. No page-level horizontal overflow, page errors, or transaction submissions. Checks include live frame delivery, older-sequence rejection, history pagination, timeframe changes, empty/error recovery, stale states, keyboard focus, and reduced motion.
- Browser screenshots and structured results: `artifacts/real-chart/browser-verification.json`, `chart-1440.png`, `chart-1280.png`, `chart-768.png`, `chart-390.png`, `chart-live.png`, `chart-error.png`, and `chart-stale.png`. These browser screenshots use test fixtures; they are not proof of live provider streaming.
- Final checks on 2026-09-23: **528 tests pass across 62 files**, including 24 focused chart/limiter tests; TypeScript and lint pass. Wider regression command:

```powershell
npx vitest run lib/market/__tests__ lib/market/live/__tests__ lib/market/enrichment/__tests__ lib/ws/__tests__ lib/hooks/__tests__ lib/discovery/__tests__ lib/trading/__tests__ --maxWorkers=1
npx tsc --noEmit --incremental false
npm run lint
```

## Boundaries

This is a real-data Lightweight Charts integration, not TradingView's licensed Advanced Charts product. Candles are explicitly labelled token-aggregate USD, not a specific DEX pool. Missing provider coverage (including newly launched tokens) is shown honestly; no local fallback invents pre-migration candles. Drawing tools, automated orders, transaction execution, and unrelated legacy token-page analytics are outside this change.
