# Discover reference refinement — 26 September 2026

## Scope

Use the supplied three-column terminal screenshot as the visual reference. Retain Sentinel's palette, Inter typography, real metric provenance, routes, filters, watchlists, and wallet-approved Quick Buy. This pass changes presentation and responsive mounting; it does not change provider priority, API contracts, lifecycle eligibility, retention queues, or transaction execution.

Figma layout specification: https://www.figma.com/design/rLXx2f2kzH2vPHZGGM7vg7

## Assessment and changes

| Finding | Implemented change |
| --- | --- |
| Conflicting CSS rules and several stacked full-width card sections | One explicit responsive card grid; flat surfaces and thin dividers |
| Small token images and scattered identity data | 60–96px images, address underneath, symbol/name, age/socials, actual X handle, then holder/trader/creator activity |
| Market figures competed with names and actions | Right-aligned market area; volume, market cap, liquidity, transactions and price; full names remain in tooltips |
| Expanded security widgets dominated every row | Five ownership pills remain visible; named, keyboard-operable security disclosure retains authority, LP, risk and fee evidence |
| Card action menu did not dismiss predictably | Shared Popover handles outside interaction, Escape and focus return |
| Quick Buy preferences lacked dialog semantics | Shared Modal adds dialog naming, focus containment, Escape and focus restoration; preset inputs now have accessible names |
| Unknown stale security fields could render `NaN` or `No` | Missing values stay unknown, distinct from a measured result |
| Mobile controls/footer consumed most of the workspace | Compact search/control rows, filter/freeze controls first, horizontally scrollable secondary controls and footer; 44px primary actions |
| CSS hid a second copy of the feeds without unmounting it | A single responsive feed grid; three default desktop feeds or one selected mobile feed, never both |
| A saved layout could leave the mobile selection pointing to a removed column | Select the first available column when the persisted active ID no longer exists |

## Reference research

Firecrawl inspected Axiom's public Pulse page and BullX's public entry page. BullX requires login for its terminal, so no authenticated interface or private data was inspected. Tavily located Axiom's official feature documentation.

- [Axiom Pulse](https://docs.axiom.trade/axiom/finding-tokens/pulse): supports preserving the three lifecycle columns, quick buy, ownership and activity fields, and filters.
- [Axiom Explore Tokens](https://docs.axiom.trade/axiom/finding-tokens/explore-tokens): supports keeping timeframe and watchlist controls accessible.
- The user's screenshot, rather than inaccessible competitor internals, is the visual layout authority.

## Verification

`scripts/discover-layout-qa.cjs` uses explicitly synthetic fixtures and intercepts all APIs/WebSockets. It cannot submit a transaction. It checks populated, pending, stale, unavailable, empty, error, loading and long-name states.

| Viewport | Default mounted columns | First fixture card height | Overflow / clipped actions |
| --- | ---: | ---: | --- |
| 1840 × 900 | 3 | 209px | None |
| 1440 × 900 | 3 | 185px | None |
| 1280 × 800 | 3 | 180px | None |
| 768 × 1024 | 3, workspace scrolls horizontally | 237px | None |
| 390 × 844 | 1, mobile tabs | 240px | None |

Narrow layouts intentionally allow wrapping and larger touch actions rather than forcing desktop density onto a phone. Mobile feed workspace increased from roughly one visible card to a 428px scroll area in the fixture check.

Browser interactions passed: mobile column switching, Quick Buy preferences and Escape, security expansion, filters, and keyboard search. Six new unit tests additionally cover route navigation, real social links, watchlist/Quick Buy event isolation, disabled Quick Buy without a confirmed venue, missing security evidence, and menu dismissal/focus.

The existing broader frontend harness checked 12 routes at four sizes (48 screenshots): terminal, portfolio, watchlist, alerts, settings, analytics, intelligence, help, developers, launchpad, AI and admin. No browser exceptions or page/header overflow were detected. These are frontend regression checks with unavailable provider responses, not live business-function certification.

TypeScript, lint, and the isolated production build passed. Discovery/UI/hooks/lifecycle regression run: 279 tests passed, one credential-dependent smoke test skipped. Captures and reports are in `artifacts/ui-audit/`.

## Operational boundaries

- The original server on port 3000 was serving an older build. The updated UI is verified separately on port 3002 so the user's running server and its build output are not interrupted. Set `UI_PREVIEW_BACKEND=http://127.0.0.1:3000` when starting `scripts/ui-preview.cjs` to reuse that backend's API and WebSocket feeds; only local HTTP targets are accepted. Host/Origin and authentication remain intact, and no second provider stream worker is started.
- Production build validation uses the existing isolated `SENTINEL_UI_PREVIEW=true` output directory. It does not overwrite the active server's `.next` output.
- Missing provider evidence still displays honestly as pending/unavailable. This visual refinement does not fabricate data or claim the live audit/provider issues are resolved.
- Existing uncommitted lifecycle and feed changes were preserved. Mainnet transaction submission was not exercised.
