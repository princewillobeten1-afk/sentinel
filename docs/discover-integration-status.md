# Discover real-time integration status

Updated 2026-09-13. This is an implementation/verification record, not a claim that the full approved plan is complete. Existing unrelated edits were preserved. No transactions were submitted.

## Changes in this continuation

- Ownership parsing preserves measured zero but rejects blank, negative, malformed and out-of-range metrics. Missing tag collections are not zero classifications. Incomplete profiles cannot refresh a card as a complete current ownership audit.
- Risk scoring is versioned as `ownership-v2`. It requires every scoring input for completeness, rejects invalid percentages, and excludes partial scores from minimum-safety filters. Watchlisting no longer turns missing risk evidence into a low-risk label.
- Reconnects subscribe to the current visible mint set. A 15-second eligibility check schedules due ownership/security work even when the viewport does not change; each worker still enforces its TTL and provider limits.
- Audit queue rebuilding does not duplicate its in-flight mint. On-demand security requests no longer replace the visible-card queue. Holder-profile 429 responses retain Retry-After.
- Per-field observation times survive Redis snapshot restoration; restored evidence is stale. Invalid timestamps cannot replace measured values. Older cached market fields cannot overwrite newer REST observations.
- DexScreener fallback selects base-token matches only. Blank/null fields remain unknown. Fallback failures do not invalidate another provider's market evidence.
- Confirmed Pump.fun `migrate` and `migrate_v2` instruction layouts identify the mint and pool. Ordinary AMM transactions, ambiguous transactions, missing block times and unsupported historical layouts do not become migration proof. A new non-Pump.fun pool cannot reset a token to a Pump.fun launch.
- Mint-authority reads validate SPL/Token-2022 ownership, account layout and initialization. Security requests have timeouts. Nonempty `lockInfo` alone no longer produces an LP-locked claim.
- Individual trade receipts flash the card but do not fabricate complete rolling-window totals or refresh unrelated market metrics. Missing creator migration counts are not zero. Jupiter's mint-as-first-pool placeholder cannot enable Quick Buy.
- Market-live health includes evidence persistence write counters. `node scripts/discover-integration-health.cjs` checks database/Redis access without printing credentials or submitting transactions.
- Rugcheck's largest-liquidity pool now supplies the exact LP-lock percentage and provenance. The UI says LP Locked, never LP Burned, and retains unknown when no market record is measured.
- Birdeye Token Stats maps exact 5-minute volume, buy/sell volume, counts, transaction count, and price change. Discover applies live 5m/1h/24h fields as one selected window and guards REST/WebSocket races per field.
- The token-card endpoint now starts bounded creator funding, confirmed developer-balance, and indexed exact-image-URL enrichment; completion is delivered on `token.card:<mint>` and creator snapshots are persisted when PostgreSQL is available.
- Authenticated wallet positions now use confirmed Helius balances plus Birdeye per-token wallet PnL instead of the mock portfolio service.

## Verification

| Check | Result |
| --- | --- |
| Full Vitest suite | Final rerun: 213 files / 1,369 tests passed |
| Affected suites after those edits | 31 files / 321 tests passed |
| TypeScript and Next lint | Final rerun passed; lint reported no warnings or errors |
| Prior responsive UI pass | See `ui-cleanup-verification.md`; synthetic browser fixtures, not live ownership validation |
| Local read-only market status | Ownership quota paused, no cached holder profiles; Redis degraded |
| Direct database/Redis checks | PostgreSQL reachable on 5434; Redis reachable on 6380; evidence table verified |
| Docker dependency check | Project `db` and `redis` containers running; migration 033 applied |
| 15-minute, 30-card live soak | Not completed; ownership quota prevents coverage validation |

The existing running development server uses long-lived worker singletons. A clean application restart is needed to load every worker change and discard legacy in-memory lifecycle records. This continuation did not stop the shared running server or connected browser sessions.

## Remaining approved work

| Area | Remaining work / limitation |
| --- | --- |
| Ownership live coverage | Restore Birdeye quota, verify the real account's stream/REST entitlements, then measure 30-card coverage and latency. The shared REST gate currently permits one request per 2.4 seconds: an all-cold 30-card ownership pass alone takes at least ~72 seconds, before network time or competing work. The 15–60 second target is not met by assertion. |
| Distributed coordination and durability | Redis hot snapshots, fan-out and per-mint leases are live, and PostgreSQL evidence writes have an applied table. The work queue is still process-local; PostgreSQL recovery reads and a fully distributed bounded queue remain to be implemented and tested. |
| LP control / liquidity removal | Rugcheck's reported largest-pool LP-lock percentage is integrated and time-stamped. Independent raw LP-account decoding, lock expiry, and liquidity-removal event history remain to be added before Sentinel can independently verify the provider report. |
| Developer identity and history | Holder Profile dev classification and bounded creator-age enrichment exist. Creator-address verification of classified dev holdings and complete launch/migration/rug history are not finished. |
| Rug evidence model | Ownership/authority scoring is implemented. Complete creator-history and liquidity-change evidence is not; partial scores must remain visibly partial. |
| Lifecycle coverage | Exact modern Pump.fun migration decoding is implemented; historical Raydium/other layouts are not guessed. Account-change-driven curve reconciliation and captured live migration fixtures need further verification. |
| Visible-set coordination | Each column reports visibility through its live hook and server demand is deduplicated. A single shared client connection/set across all three columns is not yet implemented. |
| X / recent viewers | Official X follower integration and authenticated viewer telemetry are not implemented. Counts must remain unavailable. |
| Provider failures / recovery | Quota, circuit, timeout and cache tests exist. Account-level WebSocket errors, cross-instance recovery and ownership latency still need live smoke/soak tests. |
| Browser evidence states | Repeat populated/pending/stale/unavailable and long-name checks against the final normalized pipeline, including confirmed-pool Quick Buy disabled/enabled semantics without submitting orders. |

## Provider contract references

- Migration account indices and instruction discriminators: [Pump.fun official IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json), checked 2026-09-12. Both supported migration instructions have no arguments.
- [Birdeye WebSocket](https://docs.birdeye.so/docs/websocket), [Holder Profile release](https://docs.birdeye.so/changelog/20260417-release-token-holder-profile-positions-apis).
- [DexScreener API](https://docs.dexscreener.com/api/reference).

## Rerun

```text
node scripts/discover-integration-health.cjs
npx tsc --noEmit
npm run lint
npx vitest run
```

The final local run started only this project's dependencies (`docker compose up -d db redis`), applied migration 033, and verified the table directly through the read-only health script.
