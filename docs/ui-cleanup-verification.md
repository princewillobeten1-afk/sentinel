# Core terminal UI cleanup verification

Verified locally on 2026-09-11. Existing unrelated work was preserved; no transactions were submitted.

## Implemented

- Terminal-scoped palette, typography, spacing, focus and reduced-motion rules.
- Shared density and optional viewport-fitted AppShell mode; Discover also fits when selected inside the dashboard.
- Keyboard-accessible search, labelled navigation controls, quieter sidebar/header, reachable mobile actions.
- Overview heading, summary availability indicators, consistent token cards and responsive section controls.
- Discover's independently scrolling 290px-minimum columns and mobile column tabs.
- Actual token Trade route and dashboard Trade layout: flexible chart plus 320px order rail at 1280px+, stacked chart/order/details below that.
- Loading buttons retain their labels. Small token prices use the existing precision-aware formatter.
- Watchlist cache restores after hydration, preserving stored data without mismatching the server's first render.

## Results

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Passed |
| Next lint | Passed, no warnings/errors |
| Affected discovery and UI tests | 16 files, 168 tests passed |
| Overview, Discover, token Trade | No horizontal page overflow at 1440x900, 1280x800, 768x1024, 390x844 |
| Discover | Document height exactly equals viewport height at all four sizes; footer remains visible |
| Token Trade | 320px desktop order rail; chart/order/details stack below 1280px |
| Dashboard-rendered Trade | No horizontal page overflow at widths 1440, 1280, 768 and 390 |
| Browser runtime/hydration errors | Zero in final populated and unavailable passes |
| Interactions | Sidebar expand/collapse, mobile navigation, keyboard search/focus, filter drawer/Escape, nested watchlist action, quick-trade drawer, mobile column selection and Trade detail tabs passed |
| Additional states | Long token name, unavailable/error, empty and loading inspected; reduced-motion context enabled and mobile search target >=44px |

The harness uses synthetic discovery/token data and intercepted API failures. Server-action market-summary reads and WebSockets are not mocked; these checks are not a live-market accuracy or transaction integration certification. Chart error states were exercised, not a populated live chart or wallet-connected trading flow.

## Artifacts and rerunning

Final screenshots and machine-readable measurements are in `artifacts/ui-cleanup/after` and `artifacts/ui-cleanup/after-populated` (git-ignored).

Run the isolated preview with `node scripts/ui-preview.cjs`, then:

```text
node scripts/ui-cleanup-qa.cjs after
node scripts/ui-cleanup-qa.cjs after populated
npm run lint
npx tsc --noEmit
npx vitest run lib/ui/__tests__ lib/discovery/__tests__ --maxWorkers=1
```

The preview uses port 3002 and `.next-ui-preview`; normal Next configuration is unchanged unless `SENTINEL_UI_PREVIEW=true`.

Before screenshots were captured and inspected initially, but their original `.next` location was cleared during a later development rebuild. They cannot be supplied as a retained image comparison. Recorded baseline issues included 618px Overview document width on a 390px viewport, 553px widths on the other mobile pages, and Discover heights of 1001/901/1167/995px for the four target viewports. Final artifacts are stored outside the build cache to avoid this loss.

`git diff --check` still reports an existing blank line at EOF in `lib/discovery/format.ts`; that unrelated user change was left intact.
