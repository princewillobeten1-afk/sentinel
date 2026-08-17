# Threat Model

STRIDE-style pass over the four areas this sprint actually touched:
authentication, trading, the developer API, and admin. Not exhaustive —
scoped to where real controls exist to evaluate, per
[`README.md`](./README.md)'s "deep core" framing.

Legend: **S**poofing, **T**ampering, **R**epudiation, **I**nformation
disclosure, **D**enial of service, **E**levation of privilege.

## Authentication & sessions

| Threat | Vector | Mitigation |
|---|---|---|
| S | Forged session JWT (guessed/leaked signing secret) | Production fails hard if `AUTH_JWT_SECRET` is unset (no more hardcoded fallback); dev uses a random per-process secret |
| S | `demo-token`/`login` backdoor reachable in production | Both hard-gated behind `NODE_ENV !== 'production'` — structurally unreachable, not just logically skipped |
| T | Signature-verification bypass via a crafted/malformed signature | `verifyEd25519Signature` fails closed unconditionally on any exception (was: fail-open) |
| R | A stolen session token used indefinitely with no way to revoke it | `lib/server/session-store.ts` — every session is now a real, revocable record; `verifyAuthToken` checks it on every request |
| I | Account takeover via a leaked token going undetected | `NEW_DEVICE_LOGIN` audit event fires on first-seen IP/user-agent |
| E | MFA bypass by hitting the pre-MFA code path directly | MFA-enabled accounts never receive a real session from `auth/verify`/`login` — only a single-use, 5-minute challenge token; the real session is minted only by `mfa/challenge/verify` after a correct code |
| D | Brute-forcing a 6-digit TOTP code or backup code | Rate-limited (5 attempts / 5 min) on `enroll/confirm`, `disable`, `challenge/verify` |
| S | CSRF: a malicious page triggering a cookie-authenticated mutation | `lib/server/csrf.ts` — Origin/Referer must match Host for any non-GET request on the cookie credential path |

## Trading / execution

| Threat | Vector | Mitigation |
|---|---|---|
| E | A user bypassing pre-trade risk limits (trade size, price impact) | `PreTradeRiskEngine` now actually runs in `execution/submit` and `trading/prepare` — previously built but never called from either |
| T | A client claiming a slippage tolerance the actual quote violates | Enforced server-side: request rejected if `quote.priceImpact` exceeds the caller's stated limit |
| D | A single bad pair/market condition producing repeated catastrophic executions | Circuit breaker auto-pauses `TRADING` after 3 extreme-impact (>12%) quotes for the same pair within 60s |
| D | No way to stop trading platform-wide during an active incident | Kill switch (`lib/server/kill-switch.ts`), admin-triggerable via dual control |
| E | A single compromised admin account pausing/resuming trading unilaterally | Dual control requires a second, distinct admin — `dualControlStore.approve()` rejects `approvedBy === requestedBy` server-side |
| R | No record of why a trade was blocked or a breaker tripped | `TRADE_BLOCKED_BY_RISK_ENGINE`, `CIRCUIT_BREAKER_TRIGGERED`, `KILL_SWITCH_*` audit events |

Out of scope here because it doesn't exist yet: real MEV exposure, real
DEX-adapter manipulation — trade execution itself is still 100% simulated
(`lib/execution/engine.ts`). See [`out-of-scope.md`](./out-of-scope.md).
**Real transaction-signing and broadcast do now exist**, but only for the
self-custodial wallet deposit/withdraw feature below, not for trading.

## Wallet transfers (deposit/withdraw — first real chain interaction)

Self-custodial, devnet-first: the platform never holds a key, never signs,
and never broadcasts — every transfer is signed and sent by the user's own
connected wallet extension via `@solana/wallet-adapter-react`. See
`lib/wallet/adapter-context.tsx`, `components/views/wallet-send-modal.tsx`,
`components/views/wallet-receive-modal.tsx`.

| Threat | Vector | Mitigation |
|---|---|---|
| S | Sending to a typo'd/malicious destination address | `isValidSolanaAddress` (`lib/wallet/validation.ts`) rejects malformed/wrong-length input before any signature is requested; a "you've never sent here before" warning (the user's own transaction history only, never a global blocklist) on first-time destinations |
| S | Devnet/mainnet confusion — believing you're testing while actually pointed at real funds, or vice versa | `NEXT_PUBLIC_SOLANA_NETWORK` defaults to `solana:devnet`; a network badge is shown in both the receive QR modal and the send review screen |
| T | A crafted transaction doing something other than what the review screen showed | `connection.simulateTransaction` runs on the exact `Transaction` object before it's ever handed to the wallet for signing; the review screen renders from that same object, not separately-trusted form state |
| D | Insufficient balance or fee causing a failed broadcast after the user already approved in their extension | `checkBalanceSufficiency` (`lib/wallet/validation.ts`) blocks the review screen before a signature is ever requested |
| R | No record of a user's own past transfers | `wallet_transactions` (in-memory, real — `lib/server/store.ts`; schema-as-documentation in `db/migrations/018_wallet_transactions.sql`), recorded via the audit action `WALLET_WITHDRAWAL_RECORDED`, **only after** on-chain confirmation succeeds — a cancelled/failed attempt is never recorded |
| E | A wallet *connection* (SIWS, proven ownership only) being mistaken for standing authorization to move funds | Unchanged and untouched by this feature: SIWS still "does NOT authorize any blockchain transactions" (`components/layout/wallet-modal.tsx`). Every send requires a fresh, explicit `sendTransaction` call through the user's own extension each time — there is no session-based or cached authorization path for transfers, and the real wallet-adapter connection (`useWallet()`) is entirely separate from the hand-rolled SIWS adapter (`lib/wallet/solana-adapter.ts`), which still fabricates fake keys/signatures when no extension is installed and must never be reachable from this flow |
| D | An incident caused by a bug in this feature's own construction/validation logic | `WALLET_TRANSFERS` kill-switch scope (`lib/server/kill-switch.ts`) — single-admin, not dual-control (there's no fund-moving platform action to gate; it only hides the Send UI and blocks new history entries, since nothing server-side can stop a transaction the user's wallet already broadcast) |

Out of scope here: mainnet support (devnet-only — the env wiring technically
allows an override, but nothing about copy/UX/QA has validated real-value
behavior), multi-signature/threshold approval for large transfers, an
address-book/whitelist feature, and any platform-side ability to reverse,
freeze, or claw back a transfer the user's own wallet already broadcast —
structurally impossible in a self-custodial model, not a deferred feature.
See [`out-of-scope.md`](./out-of-scope.md).

## Developer API (Sprint 28 gateway, extended this sprint)

| Threat | Vector | Mitigation |
|---|---|---|
| E | An API key with narrow scopes performing a broader action | Scope enforcement in `lib/server/api-gateway.ts`, unchanged this sprint but now covers the sibling routes rewired for real engines |
| I | Object-level authorization gap (user A reading user B's data via a resource ID) | Portfolio/session/admin routes explicitly check ownership (`session.userId !== user.userId`, `getPortfolioForWallet`'s `isWalletAuthorized`) |
| D | Unbounded request volume from a single caller | Tiered rate limiting (`lib/server/rate-limit-v2.ts`, unchanged) |
| I | Committed secrets in the repo | `scripts/scan-secrets.mjs` in CI, scans every `git ls-files`-tracked file |
| T | A known-vulnerable dependency shipped silently | `npm audit` in CI (informational for now — see [`out-of-scope.md`](./out-of-scope.md) for why it isn't blocking yet) |

## Admin

| Threat | Vector | Mitigation |
|---|---|---|
| E | Any authenticated user reaching an admin route | `role` field now actually enforced (`lib/server/rbac.ts`) — previously defined but never checked anywhere |
| E | A single admin unilaterally executing a critical action (pause trading, change a role) | Kill-switch actions require dual control; role changes are individually audited (`ROLE_CHANGED`) — role changes themselves are **not** dual-controlled this sprint (see [`out-of-scope.md`](./out-of-scope.md)) |
| R | No record of admin actions | Every admin mutation in `app/api/v1/admin/**` calls `recordAuditEvent` |

## Notably not modeled here

- **AI systems** — no real AI/LLM exists in this codebase; see [`ai-policy.md`](./ai-policy.md).
- **Smart contracts** — no real on-chain program exists anywhere in this repo; launchpad deployment is simulated.
- **Insider/employee threat** — there's no real employee org or production-access model to threat-model against; see [`out-of-scope.md`](./out-of-scope.md).
