# ADR-001: PostgreSQL Range Partitioning and Archiving Strategy for High-Volume Ledger Data

## Status
Accepted (Sprint 32)

## Context
Project Sentinel processes high-frequency trading transactions, order events, market ticks, and security audit logs. As transactional volume grows, single unbounded monolithic tables degrade query performance, bloat B-tree indexes, and make vacuuming inefficient.

## Decision
1. Implement monthly range partitioning on all high-volume operational ledgers (`trade_executions_partitioned`, `market_ticks_partitioned`, `audit_logs_partitioned`) keyed by `created_at` / `tick_timestamp`.
2. Establish a tiered lifecycle:
   - Hot Storage (0–90 days): Active partitioned tables in primary PostgreSQL with query-optimized composite indexes.
   - Warm Storage (90–365 days): Compressed historical monthly partitions.
   - Cold Archive (>365 days): Compressed Parquet exports migrated to analytical object storage (`archived_trade_history`), queryable via external analytical engines.
3. Enforce automated partition management via scheduled maintenance workers.

## Consequences
- Fast point and range queries bounded to relevant monthly partitions (partition pruning).
- Maintenance and vacuuming run per partition rather than locking entire tables.
- Historical data older than retention limits can be dropped cleanly with `DROP TABLE partition_name` in O(1) time without vacuum overhead.
