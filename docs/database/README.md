# Project Sentinel: Master Database Architecture & Data Model (Sprint 35)

This documentation suite defines the complete production database architecture and data model for Project Sentinel.

---

## 1. Database Documentation Index

1. [Database Architecture & Store Responsibilities](01-database-architecture-and-stores.md) — PostgreSQL, Redis, ClickHouse, Object Storage.
2. [Multi-Domain PostgreSQL Production Schemas](02-domain-schemas.md) — 16 Domains, Entities, Fields, Types, and Constraints.
3. [Feature Store & Data Lineage](03-feature-store-and-data-lineage.md) — Pre-aggregated feature store and reproducible intelligence lineage.
4. [ACID Transactions, Concurrency & Idempotency](04-concurrency-transactions-and-idempotency.md) — Multi-table transactions, idempotency keys, append-only ledgers.
5. [Indexing, Partitioning & Performance](05-indexing-partitioning-and-performance.md) — B-Tree/GIN indexes, monthly range partitioning, read replicas.
6. [Backup, Disaster Recovery & Security](06-backup-disaster-recovery-and-security.md) — PITR, RPO/RTO targets, TLS/KMS encryption, private VPC.

---

## 2. Definition of Done: End-to-End Data Traceability

### A. Financial State Traceability:
```text
USER ──► WALLET ──► TRANSACTION ──► TRADE ──► POSITION ──► PORTFOLIO ──► P&L
```

### B. Token Intelligence Traceability:
```text
BLOCKCHAIN ──► TOKEN ──► WALLETS ──► CLUSTERS ──► OWNERSHIP ──► CREATOR ──► VOLUME ──► INSIDERS ──► EXITABILITY ──► RISK SCORE ──► EXPLANATION
```

Every score, audit flag, trade execution, and balance is verifiable, traceable, and reproducible.
