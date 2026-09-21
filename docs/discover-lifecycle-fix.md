# Discover lifecycle correction — 2026-09-21

## Fixed

- The live discovery service bypassed the lifecycle engine. Final Stretch was any recent Pump.fun launch, sorted by market cap; Migrated was every recent token that failed that bonding test. Ordinary AMM listings therefore appeared as migrations.
- Both columns now select from the on-chain lifecycle engine and fetch metadata by mint. New Pairs retains its existing source and behavior.
- Final Stretch requires a fresh, incomplete curve at or above `LIFECYCLE_FINAL_STRETCH_PCT` (default 80%). Readings expire after two minutes. No minimum-count padding, market-cap inference, or low-progress backfill.
- Migrated requires a decoded successful migration, destination pool, signature and block timestamp within `LIFECYCLE_MIGRATED_WINDOW_MIN` (default 120 minutes). No old-event padding. Different mints sharing a name remain distinct.
- A completed curve awaiting a destination transaction is not yet Migrated. A 98% curve is still bonding.
- Migration-time ordering and the displayed migration age no longer use token launch age. Solscan proof links use the decoded signature.
- Out-of-order curve readings and stale card replay cannot overwrite newer lifecycle evidence or regress a confirmed migration. Column membership is rechecked after asynchronous metadata reads.
- Lifecycle updates now notify the discovery topics, bringing forward REST reconciliation for cards not already subscribed.
- Restart/reconnect recovery reads the same narrow migration authority used by the live subscription. It checks up to 100 recent signatures and decodes at most eight per pass, with retry/deduplication. Busy pool swap history is no longer the only recovery path.
- Jupiter seed requests and history lookups have bounded timeouts. Metadata lookups are cached/deduplicated; complete metadata failure surfaces as an error rather than fake tokens.

## Verification

- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Lint: no warnings or errors.
- Affected Discovery, lifecycle, live-hook, stream-demand and topic-plan suites: 24 files, 281 tests passed.
- Browser fixtures at 1440×900, 1280×800, 768×1024 and 390×844: bonding status at 98.5%, migration-time ordering despite older launch age, correct proof link, Final Stretch → Migrated transition, mobile column tabs, no page errors or horizontal overflow.
- Read-only live smoke at 2026-09-21 02:20 UTC: all four Jupiter requests succeeded; 12/12 candidate curves decoded; eight migration transactions confirmed and returned by the corrected service, with real signatures and pool addresses. No sampled active curve met 80%, so Final Stretch was empty rather than padded.
- Browser results: `artifacts/discover-lifecycle/browser-report.json` and screenshots. Live results: `artifacts/discover-lifecycle/live-smoke.json`. Browser fixtures are not a live-stream soak.

## Boundaries and operation

- Current lifecycle adapters cover Pump.fun curves and modern PumpSwap migration instructions. Other launchpads/historical migration layouts are not guessed.
- Candidate coverage remains bounded by configured feeds, tracked tokens and provider availability. This check does not establish exhaustive market coverage or long-running stream latency.
- Ownership/risk integrations, transaction submission and automatic trading are unchanged. No transactions were submitted.
- Restart an already-running `npm run dev` process to reload long-lived lifecycle workers and clear legacy in-memory records. Normal startup through `server.js` starts the worker; the isolated UI preview intentionally does not.

## Repeat checks

```text
node scripts/discover-lifecycle-smoke.cjs
node scripts/ui-preview.cjs
node scripts/discover-lifecycle-qa.cjs
npx vitest run lib/discovery/__tests__ lib/market/lifecycle/__tests__ lib/hooks/__tests__/use-live-token-updates.test.ts lib/market/live/__tests__/stream-demand.test.ts lib/ws/__tests__/topic-plan.test.ts --maxWorkers=1
```

Run the UI preview and browser test in separate terminals. The smoke script is read-only; the browser regression blocks API mutations and uses deterministic fixtures.
