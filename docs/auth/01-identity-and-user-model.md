# 01. Identity and User Model

## 1. Identity vs Wallet Separation

A core architectural principle of the platform is the distinction between application user identity and blockchain wallet identity:

```text
                     ┌───────────────────────────────┐
                     │          USER IDENTITY        │
                     │  - id: "usr_94a2f..."         │
                     │  - status: ACTIVE             │
                     │  - email: trader@domain.com   │
                     │  - role: user                 │
                     └───────────────┬───────────────┘
                                     │ 1:N
             ┌───────────────────────┼───────────────────────┐
             ▼                       ▼                       ▼
   ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
   │   Solana Wallet   │   │  Ethereum Wallet  │   │    Base Wallet    │
   │  7xAb...91Kp      │   │  0x71C...88F1     │   │  0x49B...C12A     │
   │  (Default / Primary)  │  (Linked / Active)│   │  (Linked / Active)│
   └───────────────────┘   └───────────────────┘   └───────────────────┘
```

- **User**: The authoritative tenant holding application state, preferences, permissions, and audit logs.
- **Wallet**: A cryptographic public address verified through digital signatures. A user may own multiple wallets across multiple blockchain networks.
- **Multi-Auth**: Accounts can authenticate via standard credentials (Email/Password) or directly via cryptographic wallet proof ("Sign in with Wallet").

---

## 2. User Lifecycle and Account States

```text
 [Registration / Wallet Auth] ──► ACTIVE ──┬──► SUSPENDED (Administrative / Risk Lock)
                                    ▲      │
                                    │      ▼
                                    └──── DELETED (Deliberate User Request / Soft Delete)
```

1. **ACTIVE**: Full access to all platform features, trading terminals, and API routes within permitted scopes.
2. **SUSPENDED**: Account locked by security risk controls or administration. All active sessions are immediately revoked, and API access is denied (`403 ACCOUNT_SUSPENDED`).
3. **DELETED**: Account deactivated upon user request. Associated credentials and sessions are revoked. Critical financial records, orders, and audit lineage are preserved rather than cascade-deleted to comply with regulatory and audit requirements.

---

## 3. Credential Security & Password Policy

- **Algorithm**: Key derivation using `scryptSync` with per-user cryptographically random 16-byte salt, cost parameters $N=16384, r=8, p=1$, and output length 64 bytes.
- **Verification**: Timing-safe buffer comparison (`crypto.timingSafeEqual`) to mitigate side-channel timing attacks.
- **Password Policy**:
  - Minimum length: 8 characters (max 128 characters).
  - Common / breached password protection.
  - Rate limited authentication attempts per IP and per account identifier.
- **Email Verification**:
  - Verification tokens are generated using 32 cryptographically secure random bytes.
  - Raw tokens are transmitted via verification links and immediately hashed with SHA-256 before storage in `email_verification_tokens`.
  - Tokens expire in 24 hours and can only be used once.

---

## 4. User Profile Safe Fields

When retrieving or updating user profiles (`/api/v1/users/me`):

| Field | Read Access | Mutability | Constraints |
|---|---|---|---|
| `id` | Public | Read-only | System immutable |
| `email` | Authenticated | Change Flow Only | Requires verification |
| `displayName` | Public | Mutable | 2–50 characters, sanitized |
| `avatarUrl` | Public | Mutable | Valid URL or preset |
| `role` | Public | Read-only | Controlled by RBAC / Admin |
| `status` | Public | Read-only | Controlled by Admin / Security |
| `preferences` | Authenticated | Mutable | Theme, currency, auto-lock |
