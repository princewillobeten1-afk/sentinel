# 12 — Data Platform, Storage & Search Architecture (Sprint 34 §61-66)

## 1. Multi-Tier Data Storage Topology

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. TRANSACTIONAL DATABASE (PostgreSQL 16)                                   │
│ • Users, linked wallets, authentication sessions, API keys, RBAC roles      │
│ • Order states, active limit triggers, trade ledgers, launchpad config      │
│ • Monthly range partitioning on `trade_executions` and `audit_logs`         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. IN-MEMORY CACHE & REAL-TIME STATE (Redis 7 Cluster)                      │
│ • Hot market price tickers, latest 1-second ticks, 24h volume sorted sets   │
│ • WebSocket connection sessions, rate-limiting sliding window counters      │
│ • Distributed Redlock locks for order execution and idempotency cache       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. ANALYTICAL DATABASE (ClickHouse / TimescaleDB)                           │
│ • Billions of historical tick events, swap trades, and wallet transfer logs │
│ • Deep holder distribution graphs and wallet clustering analysis datasets   │
│ • Aggregate platform volume rollups, whale index, and P&L leaderboard data │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. OBJECT STORAGE (AWS S3 / GCP Cloud Storage)                              │
│ • Raw blockchain block dumps, indexer transaction snapshots                 │
│ • AI model weights, training artifacts, PDF audit reports, data exports     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. SEARCH ENGINE (OpenSearch / Meilisearch)                                 │
│ • Sub-millisecond token name, symbol, mint address, and pair fuzzy search   │
│ • Wallet label, creator address, and token tag index                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Workload Separation: OLTP vs. OLAP
- **Strict Isolation**: Production OLTP PostgreSQL handles live financial state (orders, user balances, security audits). Analytical batch aggregations (e.g. 90-day volume trends, whale graph traversals) are executed exclusively against the ClickHouse OLAP cluster to prevent query contention with trading execution.
- **Event-Driven Sync**: Data flows asynchronously from PostgreSQL / Geyser indexers into ClickHouse via the Canonical Event Bus (`lib/events/bus.ts`).
