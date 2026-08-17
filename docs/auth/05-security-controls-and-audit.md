# 05. Security Controls and Audit

## 1. Rate Limiting & Brute-Force Defenses

Authentication and challenge endpoints enforce granular rate limits:

| Endpoint | Target Scope | Limit Policy | Trigger Action |
|---|---|---|---|
| `POST /api/v1/auth/login` | IP + Email | 5 attempts / 60 seconds | `429 Too Many Requests` + Security Alert |
| `POST /api/v1/auth/register` | IP | 10 attempts / 10 minutes | `429 Too Many Requests` |
| `POST /api/v1/auth/forgot-password` | IP + Email | 3 requests / 15 minutes | `429 Too Many Requests` |
| `POST /api/v1/wallets/connect/request` | Wallet / IP | 10 requests / 5 minutes | `429 Too Many Requests` |

---

## 2. Account Enumeration Defenses

To prevent adversaries from mapping registered user emails:

- **Registration**: If an email is already registered, return a standard success message or generic verification response without explicitly exposing account existence.
- **Forgot Password**: The API always responds with a generic confirmation message:
  ```json
  {
    "message": "If an account exists with this email, a password reset link has been dispatched."
  }
  ```
  The response timing and status code (200 OK) are identical whether the account exists or not.

---

## 3. Security Audit Trail & Severity Classification

All authentication and identity events are persisted into `security_audit_events`:

| Action | Event Severity | Description |
|---|---|---|
| `user.registered` | `INFO` | New user account created |
| `user.login` | `INFO` | Successful user authentication |
| `user.login_failed` | `WARNING` | Bad password or credential mismatch |
| `user.logout` | `INFO` | Single session terminated |
| `user.logout_all` | `INFO` | Bulk session invalidation |
| `email.verified` | `INFO` | Email verification token confirmed |
| `password.reset_requested` | `INFO` | Password reset link generated |
| `password.reset_completed` | `INFO` | Password successfully reset |
| `password.changed` | `INFO` | Password changed via user settings |
| `wallet.connect_requested` | `INFO` | Challenge nonce issued for address |
| `wallet.verified` | `INFO` | Cryptographic signature confirmed and wallet linked |
| `wallet.conflict_detected` | `WARNING` | Verification attempted for wallet owned by another user |
| `wallet.disconnected` | `INFO` | Wallet unlinked from account |
| `account.suspended` | `CRITICAL` | Account suspended due to risk or admin action |

---

## 4. Zero-Leakage Data Redaction Rules

Under no circumstances may any of the following enter logs, audit stores, telemetry, or API error payloads:

1. Plaintext Passwords (`password`, `newPassword`, `currentPassword`)
2. Session Tokens & Bearer Tokens
3. Private Keys (`privateKey`, `secretKey`)
4. Seed / Recovery Phrases
5. Unhashed Verification / Reset Tokens

The audit service executes a mandatory recursive sanitization step stripping or redacting any key matching sensitive security patterns before persistence.
