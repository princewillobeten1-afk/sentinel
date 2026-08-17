# ADR-002: Deterministic 7-Stage Transaction Lifecycle State Machine

## Status
Accepted (Sprint 32)

## Context
Financial transactions on Solana involve multiple asynchronous steps: preflight simulation, wallet signature, broadcast to RPC/MEV endpoints, mempool propagation, and commitment verification. Ad-hoc boolean flags or unstructured status strings cause race conditions, duplicate execution vulnerabilities, and ambiguous UI states ("submitting..." forever).

## Decision
Enforce a deterministic 7-stage state machine across all transaction flows:
`CREATED -> SIMULATING -> AUTHORIZED -> SIGNED -> SUBMITTED -> PENDING -> CONFIRMED`

Terminal failure and correction states:
- `SIMULATION_FAILED`
- `USER_REJECTED`
- `SIGNATURE_FAILED`
- `BROADCAST_FAILED`
- `CONFIRMATION_FAILED`
- `REVERTED`
- `EXPIRED`
- `DROPPED`
- `RECONCILED_CORRECTION`

Rules:
1. Every state transition must follow the explicit `VALID_TRANSITIONS` graph.
2. Illegal state jumps (e.g. jumping directly from `CREATED` to `CONFIRMED`) are rejected with `400 INVALID_STATE_TRANSITION`.
3. Every transition logs timestamps and causes into `StateTransitionLog` for auditability and latency profiling.

## Consequences
- Total state determinism across web, mobile, and backend workers.
- Impossible to execute un-simulated or un-signed transactions.
- Provides exact timestamps for SLI tracking and user-facing transaction debugging.
