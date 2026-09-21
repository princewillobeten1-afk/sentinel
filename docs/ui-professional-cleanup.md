# Terminal UI/UX cleanup

## Implemented

- A quieter graphite/azure visual system with shared surface, semantic color, typography, panel, button, input, badge, and table styles.
- A shorter desktop navigation row, keyboard-accessible search at every width, reachable Quick Trade, mobile account access, and larger mobile icon targets.
- Route links let navigation finish before changing the active workspace; they no longer eagerly switch content while the old URL is still displayed.
- Header market telemetry uses the existing read-only summary endpoint with shared request deduplication and an eight-second deadline. It no longer queues unused trending-token Server Actions that can delay navigation.
- Consistent page headings across Overview, Portfolio, Watchlist, Alerts, Settings, Analytics, Intelligence, Developers, Launchpad, AI, and Operations.
- Compact Discover cards retained. Trade uses a 320px order panel from 1280px, stacks below that breakpoint, and no longer leaves a large gap between the chart and detail tabs.
- Dialog focus containment/restoration, nested overlay Escape handling, working compound popovers, accessible tab selection and sorting controls, and keyboard-readable metric explanations.
- Wallet Settings now shows the actual session state instead of always claiming verification; its hardcoded SOL-to-USD conversion was removed.
- Sample-data screens are identified as previews instead of being presented as live analysis or telemetry.
- Fixed duplicated JSX in the mobile Discover tab selector.

## Verification

Presentation checks run against the isolated preview on port 3002. Browser API requests, Server Actions, and WebSockets are intercepted; unavailable states in these screenshots are deliberate. Early runs allowed read-only Server Actions through; these revealed the header navigation delay. No trade, transfer, or administrative operation is submitted.

Commands:

```text
npx tsc --noEmit --incremental false
npm run lint
npx vitest run lib/ui/__tests__ lib/trading/__tests__/trading-panel-controls.test.js lib/discovery/__tests__/audit-pill-parity.test.ts lib/trading/__tests__/sidebar-model.test.ts --pool=forks --maxWorkers=1
npx vitest run lib/hooks/__tests__/use-market-summary.test.js --pool=threads --maxWorkers=1
node scripts/ui-professional-qa.cjs
node scripts/discover-card-size-qa.cjs
node scripts/trade-sidebar-qa.cjs
```

Screenshots and machine-readable measurements are saved under:

- `artifacts/ui-professional/`: twelve main routes at 1440×900, 1280×800, 768×1024, and 390×844.
- `artifacts/discover-card-size/`: populated cards, long names, watchlist and card actions at five widths.
- `artifacts/trade-sidebar/`: trading-panel layout and non-transactional interaction checks at four widths.

The React review guided focus management, accessible control semantics, and preservation of existing state/data flows. The suggested browser CLI was unavailable, so verification uses the project's installed Playwright tooling.

Results (2026-09-20): TypeScript and lint passed; 29 focused tests passed across isolated runs, including the non-blocking telemetry regression. The full visual sweep captured 48 route/viewport combinations without page/header overflow or browser exceptions. Search, mobile focus containment/restoration, nested popover Escape, and More → Settings navigation passed. Discover's populated-card checks passed at five widths; desktop cards measured 176–177px high and phone cards 188px. Trade-sidebar browser checks passed at four widths with no submitted transactions. Cold compiler and test-worker startup timeouts required reruns; these were not counted as passes. The trading-controls test passed with `--pool=threads --maxWorkers=1` after the fresh-session fork worker timed out.

## Boundaries

This is a terminal presentation and interaction pass, not a claim that all product features are complete. Authentication screens, every secondary tab, authenticated account flows, and every live-provider state have not received an exhaustive end-to-end audit. Existing placeholder-backed product areas remain previews. Provider integrations, transaction execution, permissions, credentials, database schema, and existing unrelated edits are unchanged by this pass.

`git diff --check` still reports a pre-existing trailing blank line in `lib/discovery/format.ts`; it was left untouched.
