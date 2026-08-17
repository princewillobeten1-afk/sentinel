# 01 — Admin Architecture, RBAC & Session Security (Sprint 39 §1-7, §74-77)

## 1. System Architecture Overview

The Project Sentinel Admin Platform functions as the **operational nervous system** of the entire trading, intelligence, launchpad, and risk infrastructure.

```text
                         ADMIN USER
                              │ (Session + MFA + Device Fingerprint)
                              ▼
                       ADMIN DASHBOARD (⌘K & Workspace)
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
      OPERATIONS          INTELLIGENCE          SECURITY
          │                   │                   │
          ▼                   ▼                   ▼
       Trading             Tokens              Threats
       Users               Wallets             Incidents
       Orders              Creators            Fraud
       Launches            Risk                Audit
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                       ADMIN API LAYER (/api/v1/admin/*)
                              │ (Role & Permission Middleware)
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
       Databases          Analytics          Blockchain
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                         AUDIT SYSTEM (SHA-256 Chained)
```

---

## 2. Admin 6-Point Provenance Principle

Every administrative mutation or state inspection must answer 6 immutable questions:

| Question | Description | Example Record |
| :--- | :--- | :--- |
| **WHO?** | Identity of admin user and assigned role | `user_admin_01` (`SUPER_ADMIN`) |
| **WHAT?** | Action performed and target entity | `TOKEN_RESTRICT_TRADING` on `So111...112` |
| **WHEN?** | ISO 8601 UTC microsecond timestamp | `2026-08-16T16:12:00.124Z` |
| **WHY?** | Explicit operational reason provided by operator | `"Coordinated insider wash pump detected by AI cluster"` |
| **FROM WHERE?** | IP address, geo-location, user-agent, session ID | `192.168.1.50`, `US-East`, `sid_99a8` |
| **WHAT CHANGED?** | Full before-and-after state diff | `status: "ACTIVE"` $\rightarrow$ `status: "RESTRICTED"` |

---

## 3. Granular Role-Based Access Control (RBAC)

To adhere strictly to least-privilege principles, the platform defines **11 distinct operational roles**:

```text
SUPER_ADMIN
├── ADMIN
│   ├── TRADING_OPERATIONS
│   ├── RISK_ANALYST
│   ├── COMPLIANCE
│   ├── SUPPORT
│   ├── MODERATOR
│   ├── FINANCE
│   ├── ANALYST
│   ├── DEVELOPER
│   └── READ_ONLY
```

### Role Matrix & Domain Permissions

| Domain | Permission | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| **Users** | `users.view` | View user profiles & non-PII trading records | All roles |
| | `users.manage` | Modify user metadata & tags | SuperAdmin, Admin, Support, Compliance |
| | `users.restrict` | Apply warnings, trade restrictions, or suspension | SuperAdmin, Admin, RiskAnalyst, Compliance |
| | `users.terminate` | Permanently terminate account access | SuperAdmin, Admin |
| **Trading** | `trading.view` | View real-time orders, trades, failed executions | All roles |
| | `trading.cancel` | Force cancel active orders | SuperAdmin, Admin, TradingOps |
| | `trading.pause` | Engage circuit breakers / trading emergency modes | SuperAdmin, Admin, TradingOps (Dual Approval) |
| **Tokens** | `tokens.view` | View token intelligence, score, metadata | All roles |
| | `tokens.restrict` | Restrict trading, hide from discovery, add warnings | SuperAdmin, Admin, RiskAnalyst, Moderator |
| | `tokens.freeze` | Freeze token launchpad / platform interaction | SuperAdmin, Admin, TradingOps |
| **Wallets** | `wallets.view` | Inspect wallet balances, transaction traces | All roles |
| | `wallets.flag` | Flag wallet for insider, wash trading, or bot activity | SuperAdmin, Admin, RiskAnalyst, Compliance |
| **Launchpad** | `launchpad.view` | Monitor upcoming, live, and graduated launches | All roles |
| | `launchpad.manage` | Modify launch tiers and whitelists | SuperAdmin, Admin, TradingOps |
| | `launchpad.pause` | Emergency pause on live launch pool | SuperAdmin, Admin, TradingOps (Dual Approval) |
| **Finance** | `treasury.view` | View treasury balances & revenue streams | SuperAdmin, Admin, Finance |
| | `treasury.manage` | Authorize protocol transfers / fee collection | SuperAdmin, Admin, Finance (Dual Approval) |
| | `fees.modify` | Update trading fees, launch fees, API pricing | SuperAdmin, Admin, Finance (Dual Approval) |
| **Security** | `security.view` | View security alerts, failed logins, anomaly logs | SuperAdmin, Admin, RiskAnalyst, Compliance |
| | `incidents.manage` | Create, assign, contain, and resolve P0-P3 incidents | SuperAdmin, Admin, RiskAnalyst, Compliance |
| **AI** | `ai.view` | View AI requests, cost, latency, quality metrics | All roles |
| | `ai.manage` | Configure model router, fallback tiers, token limits | SuperAdmin, Admin, Developer |
| **System** | `system.view` | View infrastructure metrics, RPC health, block lag | All roles |
| | `system.config` | Modify global platform configuration & flags | SuperAdmin, Admin, Developer |
| | `system.emergency` | Trigger full emergency mode / kill switches | SuperAdmin, Admin (Dual Approval) |
| **Support** | `support.view` | View customer tickets, error logs | Support, Moderator, All Admin |
| | `support.act` | Add internal notes, escalate tickets | Support, Moderator, All Admin |

---

## 4. Super Admin Dual-Control & Safety Governance

Even for `SUPER_ADMIN` accounts, the principle of dual-control is enforced for critical, irreversible operations:
1. **Global Trading Pause / Emergency State Escalation**
2. **Treasury Protocol Fund Transfers**
3. **Fee Rate Reductions / Increases > 20%**
4. **Global Risk Engine Override**

```text
Admin A (Proposer) ───[ Propose Action + Reason ]───► Dual Control Store (TTL: 30m)
                                                            │
Admin B (Approver) ───[ Review Diff + Validate ]─────► Execute Action + Record Audit
(Must != Admin A)
```

---

## 5. Admin Authentication & Session Security

1. **Multi-Factor Authentication (MFA)**: Mandatory TOTP (RFC 6238) for all admin accounts; MFA challenges required when performing sensitive actions.
2. **Device & IP Fingerprinting**: Every admin session registers browser fingerprint, IP, and geo-location. Anomalous IP shifts trigger immediate step-up auth or session suspension.
3. **Session Expiry & Idle Locks**: Admin session tokens expire in 8 hours, with mandatory 15-minute idle re-authentication.
4. **Instant Revocation**: Real-time server-side session invalidation (`sessionStore.revokeSession`).
