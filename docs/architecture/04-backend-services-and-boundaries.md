# 04 — Core Backend Services & Domain Boundaries (Sprint 34 §15-16, §84-85)

## 1. 16 Core Backend Services

| Service | Responsibility | Criticality Tier | Data Storage |
| :--- | :--- | :---: | :--- |
| **1. Auth Service** | SIWS signature validation, JWT issuance, MFA TOTP, session revocation. | P0 | PostgreSQL, Redis |
| **2. User Service** | User profiles, account settings, linked wallets, referral tree. | P0 | PostgreSQL |
| **3. Wallet Service** | Wallet connection, address labels, balance cache, multi-wallet rollup. | P0 | PostgreSQL, Redis |
| **4. Market Data Service** | WebSocket broadcast gateway, price ticker cache, order book builder. | P1 | Redis, ClickHouse |
| **5. Token Service** | Token metadata registry, decimals, mint authorities, token lock status. | P1 | PostgreSQL, Redis |
| **6. Discovery Service** | Real-time pair scanner, graduated token filters, trending momentum scorer. | P3 | Redis, ClickHouse |
| **7. Trading Service** | Swap preflight simulation, calldata builder, priority fee optimizer, dispatch. | P0 | PostgreSQL |
| **8. Order Service** | Limit orders, stop-loss trigger monitoring, order lifecycle state machine. | P0 | PostgreSQL, Redis |
| **9. Portfolio Service** | Realized/unrealized P&L calculations, cost basis tracking, transaction log. | P1 | PostgreSQL |
| **10. Intelligence Service** | Cluster graph builder, creator reputation engine, exitability evaluator. | P2 | PostgreSQL, Redis |
| **11. Creator Service** | Creator provenance, launch track record, rug history scoring. | P2 | PostgreSQL |
| **12. Alert Service** | Real-time price/whale condition evaluation, notification rules. | P3 | PostgreSQL, Redis |
| **13. Launchpad Service** | Token creation wizard, liquidity deployment, bonding curve state. | P0 | PostgreSQL |
| **14. Notification Service** | Multi-channel router (In-App, Push, Telegram, Discord, Webhooks). | P3 | Redis |
| **15. Analytics Service** | Volume aggregate rollups, whale trade indices, historical telemetry. | P4 | ClickHouse |
| **16. Admin Service** | System kill switches, fee configurations, risk rule overrides, audit viewer. | P4 | PostgreSQL |

---

## 2. Modular Monolith vs. Distributed Microservices
- **MVP Standard**: All 16 domain services are organized into cleanly decoupled TypeScript modules within `lib/` and `app/api/v1/`. They communicate via strongly-typed in-memory function calls and the Canonical Event Bus (`lib/events/bus.ts`).
- **Physical Service Extraction Trigger**: A service is extracted into an independent containerized microservice only when:
  1. Throughput requires independent horizontal scaling (e.g. Market Data WebSocket Cluster, Blockchain Indexers).
  2. Failure isolation is critical for security/resource constraints (e.g. AI Inference Worker, Blockchain Signer).
  3. Deployment cadence or distinct team boundaries require independent release cycles.
