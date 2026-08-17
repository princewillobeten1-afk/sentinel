# Key Management Policy

## Today's reality (non-custodial)

Project Sentinel never holds a user's private key or seed phrase, anywhere,
under any code path. This was confirmed by direct investigation this
sprint — a repo-wide grep for `privateKey`, `seedPhrase`, and `secretKey`
returns zero hits in project source. Wallet connection is entirely
non-custodial Sign-In-With-Solana: the challenge/nonce flow
(`app/api/v1/auth/challenge`, `app/api/v1/auth/verify`) verifies an Ed25519
signature the wallet extension produced client-side; the key itself never
leaves the browser/extension.

This means most of a typical "key management policy" — HSM-backed signing
services, key isolation by purpose (user/treasury/deployment/admin), a
signing-service layer between the application and raw keys — describes
infrastructure this platform doesn't have and, as a non-custodial platform,
may never need for user funds specifically. It's documented below as
**target architecture**, for the day custodial features (if ever) are
added, not as a description of what exists today.

## Secrets that do exist today, and how they're actually handled

| Secret | Storage | At-rest protection |
|---|---|---|
| API key secrets | `lib/server/api-keys.ts`, in-memory | SHA-256 hash — the secret has 192 bits of entropy from `crypto.randomBytes`, so a fast hash is an intentional, documented choice, not a shortcut (see that file's own comment) |
| Webhook signing secrets | `lib/webhooks/store.ts`, in-memory | Stored in plaintext (needed to compute outbound HMAC signatures on every delivery — same constraint as TOTP secrets below) |
| MFA backup codes | `lib/server/mfa-store.ts`, in-memory | SHA-256 hash — only ever compared, never recomputed, so hashing has no downside here |
| **TOTP secrets** | `lib/server/mfa-store.ts`, in-memory | **Plaintext.** HMAC needs the plaintext secret to compute the expected code on every verification — this is an inherent property of TOTP, not a shortcut, and it sits in the same in-memory store as everything else in this codebase today |
| JWT signing secret | `env.AUTH_JWT_SECRET`, or a random per-process value in dev | Not stored in code (previously was — a hardcoded fallback existed and has been removed this sprint); production now fails hard rather than falling back to a guessable value |

## The honest gap: TOTP secrets and webhook secrets in plaintext

Both TOTP secrets and webhook signing secrets need their plaintext value
at verification/signing time, and this codebase has no KMS or envelope-
encryption layer to decrypt-on-demand from. They sit in the same in-memory
`globalThis`-guarded store as every other piece of application state. This
is a real, acknowledged gap relative to a production system with real user
funds at stake — stated plainly here rather than hidden behind a "secrets
are protected" claim that wouldn't be true.

**Target architecture**, once a real database and a real secrets manager
exist:

```
Application
     ↓  (never sees the raw secret)
Envelope-encrypted column (KMS-wrapped data key per row)
     ↓
Real KMS (cloud provider or self-hosted)
     ↓
Decrypt only at the point of use (TOTP verification, HMAC signing),
never logged, never returned in an API response after creation
```

`db/migrations/011_security_platform.sql`'s header comment calls this out
explicitly on the `mfa_credentials` table specifically, so the gap is
visible at the schema level too, not just in this doc.

## Key isolation (target, once custodial or admin-signing features exist)

If this platform ever adds a feature that requires holding a key on a
user's behalf (a custodial option, a treasury, a deployment key for a real
launchpad contract), the target model is:

- **User wallet keys** (if ever custodial) — never share infrastructure with anything else below.
- **Treasury keys** — multisig, spending limits, simulated before execution.
- **Deployment keys** (for a real on-chain program, once one exists) — separate from operational/admin keys.
- **Admin/operational keys** — separate again, least-privilege per role (see `lib/server/rbac.ts`'s role model as the starting point for how roles are already distinguished at the application layer).

None of this exists today because none of the underlying features
(custody, treasury, real on-chain deployment) exist today. Building the key
infrastructure ahead of the feature that needs it would be speculative.
