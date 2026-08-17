# ADR-008: Disaster Recovery, RPO/RTO Targets, and Eventual Blockchain Reconciliation

## Status
Accepted (Sprint 32)

## Context
In decentralized trading systems, external blockchain state (Solana mainnet) is the canonical source of truth for token ownership and executed swaps. Temporary RPC desyncs, mempool drops, chain reorgs, or database crashes can cause internal platform state to drift from reality.

## Decision
1. Establish explicit Disaster Recovery Objectives for mature production infrastructure:
   - Recovery Point Objective (RPO): ≤ 1 minute for critical financial transactions and audit logs; ≤ 5 minutes for general metadata.
   - Recovery Time Objective (RTO): ≤ 15 minutes for trading and authentication service failover.
2. Eventual Blockchain Reconciliation Engine (`BlockchainReconciliationEngine`):
   - Periodically reconciles internal transaction and portfolio states against Solana RPC node state.
   - Detects discrepancies (e.g. internal trade recorded as `CONFIRMED` but on-chain tx reverted or dropped).
   - Updates internal lifecycle state to `RECONCILED_CORRECTION` and creates immutable entries in `reconciliation_discrepancies` and the security audit log.

## Consequences
- Guarantees financial correctness over convenience.
- System automatically self-heals after temporary network partitions or RPC node desyncs.
- Clear audit trail for financial accounting and dispute resolution.
