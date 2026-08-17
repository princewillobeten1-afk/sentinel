# Project Sentinel: Production Readiness Checklist (Sprint 33 §46)

A feature or service cannot be deployed to production until all criteria in this checklist are verified.

---

## 1. Product & UX
- [ ] Requirements from PRD fully implemented.
- [ ] Edge cases (zero liquidity, slippage spikes, RPC timeouts, invalid signatures) handled gracefully.
- [ ] UX review passed with clear user recovery actions on all error states.
- [ ] Accessibility (A11y): Keyboard navigation, focus states, screen-reader labels, color independence (+/- signs), reduced motion support.

## 2. Engineering & Correctness
- [ ] Automated regression test suite passing with 100% success rate.
- [ ] Financial calculations verified with fixed-point `Decimal` arithmetic (no floating-point loss).
- [ ] 7-stage deterministic transaction state machine used for all on-chain operations.
- [ ] Idempotency key protection implemented on all financial write endpoints.
- [ ] In-flight concurrency locks prevent double-submit.

## 3. Security & Governance
- [ ] Authentication and least-privilege RBAC verified.
- [ ] Machine-readable structured JSON logging enabled with automated secret scrubbing.
- [ ] Sensitive cryptographic secrets (private keys, mnemonics, tokens) verified absent from log streams.
- [ ] Immutable security audit logs written for all privileged operations.

## 4. Performance & Scalability
- [ ] Latency targets satisfied under peak simulated load:
  - L0 Ultra-Critical: <500ms platform-side.
  - L1 Real-Time: <250ms event propagation.
- [ ] Multi-RPC pool configured with automated health scoring and failover.
- [ ] Database range partitioning and retention policies active.

## 5. Operations & Disaster Recovery
- [ ] Detailed health (`/api/v1/health`), liveness (`/health/liveness`), and readiness (`/health/readiness`) endpoints exposed.
- [ ] P1–P4 alerts configured with deduplication windows.
- [ ] Operational runbook written and linked to alerts.
- [ ] Disaster recovery plan documented (RPO ≤1 min, RTO ≤15 min for P0 financial services).
- [ ] Overall weighted quality readiness score ≥ 90 / 100 with zero P0 blockers.
