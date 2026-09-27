# Intelligence: measured evidence, schema 2

Both `/intelligence` and the dashboard Intelligence view now use the same live workspace. Reports require an exact, case-sensitive Solana mint. Symbol-only demo reports have been retired.

## Data path

- Current candidates come from the existing live discovery feed, without modifying its columns or queueing audits for an entire list.
- Selected reports hydrate the existing token-card cache and use the shared token-audit producer. Ownership, authorities and liquidity evidence retain their own observation times.
- Market reconciliation uses the existing primary market client. Missing/failed fields can use the exact-mint metadata response already fetched by the audit service. FDV is never relabeled as market cap.
- Audit enrichment is asynchronous. The selected report refreshes every 30 seconds while visible; controls allow an explicit retry. Background/failed requests do not erase measured observations.
- History reads real `token_card_evidence_snapshots` rows. It lists observations, not fabricated changes, and requires no schema migration.

## Public contract

`GET /api/v1/intelligence/candidates` returns current candidate identities and market observations.

`GET /api/v1/intelligence/solana/:mint` returns `schemaVersion: "2"`, token identity, metric evidence, deterministic findings, coverage, lifecycle proof and limitations. Metrics have a value, unit, status and observation time. There is no synthetic aggregate safety score or confidence percentage.

The existing `market`, `liquidity`, `contract`, `activity`, `insiders`, `organic`, `signals`, `history` and `timeline` paths use this measured contract, not the legacy sample report. Consumers of the demo's v1 field shapes must migrate. History/timeline return observation records, not price history. Organic activity is explicitly unavailable until a verified assessment exists.

Internal provider names and error diagnostics remain server-side. Token names, exact addresses and real explorer proof links are preserved. Raw source metadata is never returned by the new report adapter.

Review rules (methodology `observed-evidence-v1`): top-ten ownership >=35%, developer ownership >=5%, active mint/freeze authority, and liquidity <$10,000. These explicit thresholds are prompts to inspect evidence, not calibrated risk probabilities. Stale findings retain stale labels. Missing measurements do not silently pass a safety test.

## Limits and boundaries

Four concurrent report requests, same-mint coalescing, bounded caches and at most 20 primary market reconciliations per process per minute protect the existing budget. Upstream 401/403/429/quota failures pause that reconciliation for one minute. These local guards supplement—not replace—deployment-level public API rate limits and the existing enrichment coordinator.

Wallet clustering, organic-trading claims, rug histories, and exit-price simulations are not synthesized from aggregate data. Legacy standalone mock intelligence APIs now return an explicit retirement response. Pure legacy scoring engines remain for compatibility/tests, but the active Intelligence screens do not use them.

No chart, Discover lifecycle, provider priority, wallet signing or transaction broadcasting changes are part of this work. Trade actions only open the existing exact-mint Trade page; Watchlist uses the existing store.

## Verification

- `npx vitest run lib/intelligence/__tests__ lib/trading/__tests__/audit-route.test.ts`
- `node scripts/intelligence-ui-qa.cjs` (local UI fixtures; never trades)
- `node scripts/intelligence-live-smoke.cjs` (read-only live report and recorded history)
- `npx tsc --noEmit`, `npm run lint`, `npm run build`

Browser artifacts go to `artifacts/intelligence`. UI fixtures test presentation and interactions separately from read-only live API smoke checks.

Verified in this pass: 68 affected tests passed; TypeScript and production build passed. Lint retains two pre-existing chart hook warnings. Eight UI captures cover overview/report at 1440×900, 1280×800, 768×1024 and 390×844 with no horizontal overflow or browser runtime errors. The read-only live SOL check returned nine current metrics and real saved observation history. Unknown classifications remained unknown.
