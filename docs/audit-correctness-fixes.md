# Audit correctness fixes — 22 September 2026

## Implemented

- Audit responses are composed from current worker evidence on every read. Only the Jupiter provider snapshot is cached; an older cached response cannot override newer concentration, developer holding, or authority fields.
- Exact mint matching only. A metadata timeout or 429 preserves independent worker evidence and marks retained metadata stale. Provider source, observation time, expiry, and failure reasons survive the API-to-UI path.
- `lastAuditedAt` uses audit observations, not price ticks or identity-only metadata reads.
- The Trade Audit tab polls every 3 seconds while ownership is pending, then every 15 seconds. Requests have a 10-second deadline, do not overlap, stop for inactive/hidden tabs, and abort on token switches/unmount. Failed refreshes show a retry control and downgrade retained evidence.
- On-demand ownership rechecks follow the 60-second / migrated 180-second policy, not the 10-minute retention cache. Short detail-view leases prevent discovery queue replacement from discarding an active detail audit. Quota and circuit pauses are respected.
- Audit/security pills expire without requiring another stream event. Missing provenance, incomplete reads, failures, and expired values do not receive reassuring green styling.
- Both card implementations share the Rug Risk pill. A current complete label requires measured, unexpired ownership, authority, and liquidity evidence. Stale or incomplete evidence is explicitly labelled; watchlist risk classification is unknown in those states.
- Security scoring excludes expired inputs and no longer republishes older ownership values. Security reconciliation follows the earliest contributing expiry, including LP-lock evidence.
- Missing creator migration counts remain unknown, not zero.

## Verification

- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Lint: `npm run lint` passed.
- Selected discovery, enrichment, market-live, trading and audit-hook suites: **378 tests passed across 42 files**.
- Browser checks passed at 1440×900, 1280×800, 768×1024, and 390×844: pending → measured, stale values, failed refresh, manual recovery, and no page-level horizontal overflow or page errors.
- Browser checks use deterministic fixtures and block all external API writes, Server Actions, and transaction submissions. Automatic quote/market-focus requests are intercepted, not executed.
- Read-only provider smoke at `2026-09-22T14:11:02.652Z` succeeded for Jupiter exact-mint search, Birdeye Holder Profile, Helius mint-account decoding, and Rugcheck LP-lock data on one newly listed token. It returned measured sniper/bundler holdings and explicit nulls for unimplemented checks.
- Repeatable checks: `scripts/audit-freshness-qa.cjs` and `scripts/audit-provider-smoke.cjs`. Reports/screenshots: `artifacts/audit-freshness/`.
- Restored the missing `@testing-library/dom` peer dependency used by React regression tests. npm reported 20 dependency advisories (8 moderate, 11 high, 1 critical); dependency security remediation was not part of this audit-behavior pass.

## Boundaries

- **LP burn and honeypot/tax behavior remain Not verified.** An observed LP-lock percentage does not establish that LP tokens were burned.
- Holder classifications and risk scores are provider/model evidence, not guarantees that a token is safe or will rug.
- The live probe establishes one-token REST/RPC capability, not a sustained quota/latency guarantee. WebSocket entitlements and a long-running multi-token soak were not reverified in this pass.
- No trades, signed transactions, automated orders, or production deployments were performed.
