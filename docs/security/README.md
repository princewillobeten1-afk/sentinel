# Project Sentinel Security

Sprint 30's security foundation: real, working controls for everything
genuinely buildable given this app's actual architecture (in-memory,
`globalThis`-guarded stores; a non-custodial wallet model; 100%-simulated
trade execution), plus honest documentation for everything that needs
infrastructure or external engagement this sprint doesn't provide.

This mirrors [`docs/api/README.md`](../api/README.md)'s framing: **deep
core, honest about the rest**, not a shallow pass over all 98 sections of
the source spec.

## What's real

| Area | Status | Where |
|---|---|---|
| Session management (list/revoke/revoke-all, real JWT revocation) | **Real** | `lib/server/session-store.ts`, `lib/server/auth.ts` |
| TOTP MFA (RFC 6238, enroll/confirm/disable/backup codes) | **Real** | `lib/server/mfa.ts`, `lib/server/mfa-store.ts` |
| New-device login detection | **Real** | audited via `NEW_DEVICE_LOGIN`, `lib/server/session-store.ts#hasSeenDeviceBefore` |
| Admin RBAC | **Real** | `lib/server/rbac.ts`, enforced on `app/api/v1/admin/**` |
| Dual control (two distinct admins required) | **Real** | `lib/server/dual-control.ts` — self-approval is rejected server-side, not just hidden in the UI |
| Structured, typed audit log | **Real** | `lib/server/audit.ts`, `lib/server/store.ts#AuditLogEntry` |
| Pre-trade risk engine wired into the actual trade path | **Real** | `lib/order/risk.ts` called from `app/api/v1/execution/submit`, `app/api/v1/trading/prepare` (previously built but never called from either) |
| Slippage enforcement | **Real** | rejects a submit/prepare when the quote's price impact exceeds the caller's stated limit |
| Platform-wide kill switch (TRADING / LAUNCHPAD) | **Real** | `lib/server/kill-switch.ts`, only mutated via dual-control approval or the circuit breaker |
| Circuit breaker | **Real**, one concrete trigger | `lib/server/circuit-breaker.ts` — 3 extreme-impact quotes for a pair within 60s auto-pauses trading |
| Token security screening (honeypot/tax/transfer-restriction) | **Real** | `lib/intelligence/engines/token-security.ts`, merged into the `CONTRACT` risk dimension |
| Dangerous-approval detector | **Real logic, not yet wired to a live tx flow** | `lib/security/approval-risk.ts` — no transaction builder exists yet to call it from |
| Launchpad creator/clustering risk | **Real engines, not stubs** | `lib/launchpad/risk.ts` now calls `computeCreatorEntity`/`computeOwnershipReport` instead of flat 85/10 |
| CSP header | **Real**, first pass | `next.config.mjs` — `'unsafe-inline'`/`'unsafe-eval'` on `script-src` is a known, documented weakening |
| CSRF protection (cookie path only) | **Real** | `lib/server/csrf.ts`, wired into `requireAuth`/`requireAuthWithSession` |
| Rate limiting on brute-force-sensitive routes | **Real** | login, MFA confirm/disable/challenge all rate-limited |
| CI: tests actually run, secrets are scanned | **Real** | `.github/workflows/ci.yml` |
| AI output policy chokepoint | **Real primitive, no AI exists yet to gate** | `lib/ai/policy.ts` — see [`ai-policy.md`](./ai-policy.md) |

## What's fixed (live vulnerabilities that existed before this sprint)

- Hardcoded JWT fallback secret — removed; production now fails hard if `AUTH_JWT_SECRET` is unset (`lib/server/auth.ts`).
- `demo-token` auth bypass and the hardcoded `login` credentials — kept for dev convenience, hard-gated behind `NODE_ENV !== 'production'`, structurally unreachable in a deployed build.
- Fail-open signature verification (`lib/server/crypto-auth.ts#verifyEd25519Signature`) — now fails closed unconditionally on any exception.
- No `.gitignore` existed, and a real `.env` with live-looking API keys sat in the working tree unprotected — `.gitignore` added; key rotation flagged in [`incident-response.md`](./incident-response.md) (not performed by this sprint — that's a provider-dashboard action).
- A Decimal math bug (`lib/math/decimal.ts#toString`) silently corrupted every non-18-decimal-precision read, including the price-impact figures the new risk/slippage checks depend on — found and fixed while wiring Tier 4, not a pre-planned item.

## What's documentation, not implementation

| Doc | Covers |
|---|---|
| [`threat-model.md`](./threat-model.md) | STRIDE-style pass over auth, trading, API, admin |
| [`asset-inventory.md`](./asset-inventory.md) | What data/secrets exist and their classification |
| [`key-management-policy.md`](./key-management-policy.md) | Target architecture — explicit about today's non-custodial reality and the TOTP-secret plaintext baseline |
| [`incident-response.md`](./incident-response.md) | Severity framework, the kill switch as today's primary IR tool, the key-rotation flag |
| [`disaster-recovery.md`](./disaster-recovery.md) | RPO/RTO — stated honestly as "0 today, everything in-memory" |
| [`out-of-scope.md`](./out-of-scope.md) | Pentesting, audits, bug bounty, SIEM, HSM, multi-region — and why each needs external engagement or infrastructure this sprint doesn't build |
| [`ai-policy.md`](./ai-policy.md) | The AI chokepoint pattern, and why there's nothing else to secure yet |

## Verification

Every real control above was both unit-tested (`lib/**/__tests__/**/*.test.ts`, house Vitest convention, no mocking framework) **and** exercised live against a running `node server.js` — not just typechecked. Notably: a full two-admin dual-control kill-switch cycle (propose → self-approval rejected → distinct-admin approval → trading paused → resumed), a complete MFA enrollment-to-login cycle using an independently-computed TOTP code (not just the app's own code agreeing with itself), and a circuit breaker actually tripping after 3 real extreme-impact quotes and blocking a 4th trade.
