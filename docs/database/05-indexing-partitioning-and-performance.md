# 05 — Indexing, Range Partitioning & Read Replicas (Sprint 35 §88-91)

## 1. High-Performance Indexing Strategy
- **B-Tree Indexes for Query Paths**:
  - `users(email)`, `wallets(user_id)`: Fast user lookups.
  - `tokens(chain_id, address)`: Primary token discovery lookups.
  - `trades(token_in, timestamp DESC)`: Recent token swap feed.
  - `trades(trader_address, timestamp DESC)`: User trade history.
  - `orders(user_id, status)`: Active open limit orders.
  - `positions(user_id, token_id)`: Instant portfolio balance check.
  - `alerts(user_id, enabled)`: Real-time condition evaluation.
  - `audit_logs(actor_id, created_at DESC)`: Security audit logs.
- **GIN Indexes for JSONB Queries**:
  - `risk_signals USING GIN (evidence)`: Instant factor filtering.
  - `audit_logs USING GIN (metadata)`: Security incident forensics.

---

## 2. PostgreSQL Table Range Partitioning (`db/migrations/012_nfr_platform.sql`)
High-volume operational ledgers are partitioned by monthly range on timestamps:
1. `trade_executions_partitioned` (`created_at`)
2. `market_ticks_partitioned` (`tick_timestamp`)
3. `audit_logs_partitioned` (`created_at`)

- **Partition Pruning**: PostgreSQL query planner automatically skips non-matching monthly partitions, keeping index tree depths shallow (<4 levels) and queries sub-millisecond.

---

## 3. Read Replica Workload Routing
- **Primary Database (Read/Write)**: Financial mutations, order placement, token creation, session auth.
- **Read Replicas (Read-Only)**: Token discovery listings, historical audit searches, portfolio aggregation rollups.
- **Routing Invariant**: Financial writes and pre-trade balance checks are never routed to read replicas to avoid replication lag hazards.
