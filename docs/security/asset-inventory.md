# Asset Inventory & Data Classification

What this app actually holds, and how sensitive it is. Classification
follows the source spec's four tiers: **PUBLIC**, **INTERNAL**,
**CONFIDENTIAL**, **CRITICAL**.

| Asset | Classification | Where it lives | Notes |
|---|---|---|---|
| Token prices, market data, discovery feeds | PUBLIC | `lib/market/**`, in-memory cache | No sensitivity — this is the product |
| Wallet addresses (public keys) | PUBLIC-adjacent | `lib/server/store.ts#DbWallet` | Public on-chain, but linking one to a Sentinel account is still worth treating carefully (see PII note below) |
| Session tokens (JWT) | CONFIDENTIAL | `sentinel_session` cookie / `Authorization` header, never persisted server-side beyond the session record | Bearer credential — anyone holding one can act as that user until revoked or expired |
| Session records (IP, user agent, timestamps) | CONFIDENTIAL | `lib/server/session-store.ts`, in-memory | Used for account-takeover detection; itself a record of user behavior |
| TOTP secrets | **CRITICAL** | `lib/server/mfa-store.ts`, in-memory, **plaintext** | See [`key-management-policy.md`](./key-management-policy.md) — this is the one place this sprint's honest baseline is weaker than ideal |
| MFA backup codes | CONFIDENTIAL (hashed at rest) | `lib/server/mfa-store.ts` | SHA-256 hashed, same approach as API key secrets — only ever compared, never recomputed |
| API key secrets | CRITICAL (hashed at rest, shown once) | `lib/server/api-keys.ts` (Sprint 28) | SHA-256 hashed; plaintext shown exactly once at creation |
| Webhook signing secrets | CRITICAL (shown once) | `lib/webhooks/store.ts` (Sprint 28) | Used to HMAC-sign delivered payloads |
| Audit log entries | CONFIDENTIAL | `lib/server/store.ts#AuditLogEntry`, in-memory, capped at 500 | Contains IPs, user agents, and action details — itself sensitive, not just a record of sensitivity |
| Kill-switch / dual-control state | INTERNAL | `lib/server/kill-switch.ts`, `lib/server/dual-control.ts` | Operational state, not user data |
| User email/display name | CONFIDENTIAL (PII) | `lib/server/store.ts#DbUser` | Minimal PII footprint — no addresses, phone numbers, government IDs, or payment info anywhere in this codebase |
| Portfolio positions, P&L | CONFIDENTIAL | `lib/portfolio/**` | Per-user financial data; already private-by-default (Sprint 9's `PRIVATE_RESPONSE_HEADERS`) |
| Private keys / seed phrases | **N/A — never exists** | — | Confirmed via a repo-wide grep for `privateKey`/`seedPhrase`/`secretKey`: zero hits in project source. The platform is non-custodial by construction, not by policy — there is no code path that could hold one even accidentally |

## What's explicitly absent

No payment card data, no government-issued ID, no biometric data, no
physical address, no phone number is collected or stored anywhere in this
codebase. The PII footprint is deliberately minimal: an email, a display
name, and wallet addresses a user has linked.
