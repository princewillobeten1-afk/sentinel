# Chart-side trading panel

Implemented September 13, 2026 in the shared TradingPanel used by the direct trade route and dashboard trade view.

## Connected controls

- Buy/Sell, amount presets, editable locally saved presets, and slippage drive the existing quote request and preview flow.
- Limit and Adv. open the existing conditional-order builder with the selected side and mode. Advanced Strategy creates a separate conditional order, not an attachment to the market order.
- Sell percentages use the authenticated wallet-position quantity; the former hardcoded 10,000-token balance was removed.
- Five-minute activity uses Jupiter REST snapshots and Birdeye Token Stats WebSocket fields. The selected window now updates volume, change, buys, sells, and transaction count together, and older socket frames cannot replace newer REST windows.
- Token balances and SOL balance use confirmed Helius mainnet RPC reads through an authenticated wallet-bound endpoint. Bought, Sold, Holding, and PnL are wired to Birdeye's per-token wallet PnL endpoint with all-time weighted-average-cost provenance.
- Token Info includes all nine reference tiles, contract/developer copy and explorer actions, developer age, confirmed developer SOL balance, Helius funding attribution, Rugcheck LP-lock percentage, refresh, and explicit missing-data states.
- Reused-image results use exact image-URL matches from Sentinel's PostgreSQL token index. The UI states that this is indexed exact-URL coverage, not perceptual image matching or a full-chain result.
- Server-side Birdeye REST calls now share the same priority/rate gate as visible-card ownership enrichment. Birdeye socket subscription errors are surfaced separately from transport connection health.
- Callout opens a local editable draft that can be copied; it does not publish anything.

## Current external limitations

- The configured Birdeye key returns Holder Profile successfully, but wallet PnL returns HTTP 401 and both documented price and Token Stats subscriptions are rejected after WebSocket `WELCOME` with an origin/API-key rejection.
- Helius confirmed RPC reads are configured, but Wallet API `funded-by` returns HTTP 403. Developer balance remains usable; funding attribution remains unavailable until that endpoint is enabled.
- PostgreSQL (`localhost:5434`) and Redis (`localhost:6380`) are now running and passed the final health check. Migration `033_token_card_evidence.sql` was applied; the evidence table exists, and the image index contains 764 tokens with two currently duplicated exact image URLs.
- Custom priority fees, Jito tips, MEV protection, live mainnet swap broadcasting, persistent order execution, official X followers, perceptual image matching, and callout publishing remain separate integrations. Unknown UI values remain neutral rather than becoming zero or safe.

## Verification

- TypeScript: no errors.
- Targeted ESLint: no warnings or errors.
- Focused integration selection: 85 tests passed across 12 files; the final parser/reconciliation/security selection passed 27 tests across 7 files. A broader 602-test selection had 601 passes and one five-second audit timing timeout under parallel TypeScript load; that exact 5-test suite passed when rerun alone.
- Browser harness: `node scripts/trade-sidebar-qa.cjs` passed at 1440×900, 1280×800, 768×1024, and 390×844; no horizontal page overflow or browser runtime errors.
- Exercised amount/preset changes, unknown sell-balance disabling, Limit and Advanced dialogs, Escape dismissal, callout draft, and pending/stale/unavailable rendering.
- Screenshots and measurements: `artifacts/trade-sidebar/` and `artifacts/discover-card-size/`. Trade passed four requested sizes with no page overflow; Discover card heights remained 176–202px on desktop and 188px at 390px. Screenshots use deterministic fixture data, not a claim of live provider availability.
- All browser API calls were intercepted; transaction/order writes were blocked. No wallet signing or live transactions were performed. Unit execution tests use existing fixtures.
- A read-only live app smoke confirmed Helius WebSocket open, Redis card fan-out active, Birdeye Holder Profile measured, Rugcheck LP lock measured, Helius developer balance measured, one exact image reuse match returned, and six ownership/security/creator snapshots persisted. Birdeye WebSocket, wallet PnL, and Helius funding attribution remained visibly unavailable for the entitlement reasons above.

Unrelated pre-existing changes were preserved. Provider availability and real mainnet execution were not certified by this UI pass.
