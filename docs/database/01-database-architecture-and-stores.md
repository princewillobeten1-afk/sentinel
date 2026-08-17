# 01 — Database Architecture & Store Responsibilities (Sprint 35 §1-6)

## 1. Multi-Store Architecture Topology

```text
                               DATA PLATFORM
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
   PostgreSQL 16                  Redis 7                     ClickHouse
Transactional Financial      Hot Market Prices &          Historical Analytical
Application State (OLTP)     Fast Session State           Time-Series Datasets
        │                            │                            │
        └────────────────────────────┼────────────────────────────┘
                                     │
                                     ▼
                               Object Storage
                           (Raw Dumps / Reports)
```

---

## 2. Store Responsibilities Matrix

| Storage Layer | Primary Technology | Responsibility & Data Domains | Consistency Guarantee |
| :--- | :--- | :--- | :--- |
| **Transactional DB** | PostgreSQL 16 (RDS Multi-AZ) | Users, accounts, wallets, orders, positions, portfolio P&L, risk rules, audit logs. | **Strict ACID (Serial / Read Committed)** |
| **Hot State Cache** | Redis 7 Cluster | Latest price ticks, order book L2 cache, WebSocket connection sessions, rate limit counters, Redlock distributed locks. | **In-Memory (Ephemeral / Fast Read)** |
| **Analytical DB** | ClickHouse / TimescaleDB | Billions of raw historical swap ticks, token OHLCV candles, deep wallet clustering graphs, whale volume aggregations. | **Eventual / Append-Optimized** |
| **Object Storage** | AWS S3 / GCP GCS | Raw block dumps, AI model weights, PDF token audit exports, historical transaction archive bundles. | **Durable Blob Storage** |

---

## 3. Financial Truth Invariant
- **Rule**: Blockchain data is the source of truth for on-chain events. PostgreSQL is the source of truth for application state. Redis is strictly a performance cache and must never be treated as the permanent source of financial truth.
