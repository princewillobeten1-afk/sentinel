# 04 — Transaction Lifecycle & State Machine

## 1. 11-Stage Transaction Lifecycle

To ensure total determinism, prevent race conditions, and provide auditability, all trade transactions follow a strict state progression:

```text
  [IDLE]
     │ (user enters amount)
     ▼
 [QUOTING] ──(quote received)──> [SIMULATING]
                                      │
     ┌────────────────────────────────┴────────────────────────┐
     ▼                                                         ▼
[SIMULATION_FAILED]                                         [READY]
                                                               │ (user clicks Swap)
                                                               ▼
                                                      [AWAITING_SIGNATURE]
                                                               │
     ┌─────────────────────────────────────────────────────────┴────────────────────────┐
     ▼                                                                                  ▼
[USER_REJECTED]                                                                    [SUBMITTED]
                                                                                        │
                                                                                        ▼
                                                                                   [CONFIRMING]
                                                                                        │
     ┌──────────────────────────────────────────────────────────────────────────────────┴──────────────┐
     ▼                                                                                                 ▼
 [CONFIRMED]                                                                                        [FAILED]
```

## 2. State Transition Rules

| From State | Allowed Target States |
|---|---|
| `IDLE` | `QUOTING` |
| `QUOTING` | `SIMULATING`, `FAILED`, `EXPIRED` |
| `SIMULATING` | `READY`, `SIMULATION_FAILED`, `EXPIRED` |
| `READY` | `AWAITING_SIGNATURE`, `QUOTING`, `EXPIRED`, `CANCELLED` |
| `AWAITING_SIGNATURE` | `SUBMITTED`, `USER_REJECTED`, `FAILED` |
| `SUBMITTED` | `CONFIRMING`, `FAILED` |
| `CONFIRMING` | `CONFIRMED`, `FAILED` |
| `CONFIRMED` | (Terminal) |
| `FAILED` | (Terminal) |
| `USER_REJECTED` | (Terminal) |
| `CANCELLED` | (Terminal) |
| `EXPIRED` | `QUOTING`, `IDLE` |

## 3. Audit Trail & Diagnostics

Every state transition records an immutable log with timestamp, originating component, transaction ID, hash (if submitted), and failure reason.
