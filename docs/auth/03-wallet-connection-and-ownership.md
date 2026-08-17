# 03. Wallet Connection & Proof of Ownership

## 1. Cryptographic Challenge-Response Flow

To link a blockchain wallet to a user account, the user must prove private key ownership without revealing secrets or signing a financial transaction:

```text
Browser Client                    Backend API Server                  Blockchain Wallet
      │                                   │                                  │
      │── 1. POST /wallets/connect/req ──►│                                  │
      │   (address, chainId)              │── 2. Generate Nonce & Challenge  │
      │◄── 3. 200 OK (challengeId, msg)───│      Expires in 10 minutes       │
      │                                   │                                  │
      │── 4. Request Signature ─────────────────────────────────────────────►│
      │      (Display safety banner)                                         │
      │◄── 5. Detached Signature ────────────────────────────────────────────│
      │                                   │                                  │
      │── 6. POST /wallets/connect/verify►│                                  │
      │   (challengeId, signature)        │── 7. Verify ed25519 / secp256k1  │
      │                                   │      Check challenge expiration  │
      │                                   │      Check challenge not used    │
      │                                   │      Check ownership conflicts   │
      │                                   │      Mark challenge USED         │
      │◄── 8. 200 OK (Wallet Linked) ─────│                                  │
```

---

## 2. Standardized Message Formats

### A. Sign-In With Solana (SIWS) Format
```text
sentinel.market wants you to sign in with your Solana account:
7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm

This signature verifies ownership of your wallet. It does not authorize a transaction.

URI: https://sentinel.market
Version: 1
Chain ID: solana
Nonce: a8f9c2d1e4b7
Issued At: 2026-08-16T18:00:00.000Z
Expiration Time: 2026-08-16T18:10:00.000Z
```

### B. Sign-In With Ethereum (SIWE / EIP-4361) Format
```text
sentinel.market wants you to sign in with your Ethereum account:
0x71C...88F1

This signature verifies ownership of your wallet. It does not authorize a transaction.

URI: https://sentinel.market
Version: 1
Chain ID: 1
Nonce: e3b0c44298fc
Issued At: 2026-08-16T18:00:00.000Z
Expiration Time: 2026-08-16T18:10:00.000Z
```

---

## 3. Replay Protection & Expiration

1. **Unique Nonce**: Every verification challenge generates a cryptographically random 16-byte nonce. Challenges are never reused.
2. **Short TTL**: Challenges expire within **10 minutes** (`expires_at = now + 600s`). Expired challenges fail with `CHALLENGE_EXPIRED`.
3. **Single-Use Invariant**: Upon first verification, `used_at` is stamped. Subsequent submissions fail immediately with `CHALLENGE_USED`.

---

## 4. Multi-Wallet Ownership & Conflict Resolution

- **Multiple Wallets per User**: A user may link any number of Solana, Ethereum, or Base wallets.
- **Default Wallet Designation**: One wallet per user can be designated as `isPrimary = true`.
- **Conflict Handling**:
  - If a verified wallet is already linked to the **same user**, return the existing wallet.
  - If a verified wallet is already linked to **another user**, reject with error code `WALLET_ALREADY_LINKED` (`409 Conflict`). Wallets are never silently transferred across user accounts.

---

## 5. Wallet Disconnect Semantics

When a user disconnects a wallet via `DELETE /api/v1/wallets/:id`:
- The status is updated to `DISCONNECTED`.
- Historical transactions, trading records, and verification proofs remain intact in the database for audit lineage and accounting.
