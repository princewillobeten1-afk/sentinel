# Sprint 43 — Authentication, Identity & Wallet Connection Documentation

This documentation suite defines the complete production architecture, security boundaries, and lifecycle specifications for **Authentication, Identity, Session Management, and Cryptographic Wallet Proof of Ownership**.

---

## Master Architecture Index

1. **[01. Identity and User Model](./01-identity-and-user-model.md)**
   - Distinction between User Identity and Blockchain Wallets, Account Lifecycle States (`ACTIVE`, `SUSPENDED`, `DELETED`), Multi-Auth Methods (`EMAIL`, `WALLET`), Credential Hashing, and Safe Profiles.
2. **[02. Session Management and Security](./02-session-management-and-security.md)**
   - Server-managed sessions, secure `HttpOnly; Secure; SameSite=Lax` cookies, sliding expiration, session rotation on privilege events, and individual/bulk session revocation.
3. **[03. Wallet Connection & Proof of Ownership](./03-wallet-connection-and-ownership.md)**
   - Short-lived nonce challenges, Sign-In With Solana (SIWS) & Sign-In With Ethereum (SIWE/EIP-4361), server-side signature verification, replay prevention, and ownership conflict resolution (`WALLET_ALREADY_LINKED`).
4. **[04. Authorization and Middleware](./04-authorization-and-middleware.md)**
   - Authentication vs Authorization, route guards (`requireAuth`, `optionalAuth`), contextual request decoration (`req.user`, `req.session`), resource-level permission checks, and step-up re-authentication (`requireRecentAuthentication`).
5. **[05. Security Controls & Audit Trail](./05-security-controls-and-audit.md)**
   - Rate limiting, brute-force protection, account enumeration defenses, audit event classification (`INFO`, `WARNING`, `CRITICAL`), and zero-leakage secret filtering rules.

---

## Core Operational Invariants

> **1. A wallet is not automatically a user; a user owns one or more authorized wallets across supported blockchains.**
> **2. Never ask for seed phrases, private keys, or wallet passwords anywhere in the platform.**
> **3. Wallet connection only proves cryptographic ownership; no trading or transaction signing occurs during identity verification.**
