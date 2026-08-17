# Project Sentinel: Master Technical Architecture Blueprint (Sprint 34)

This blueprint defines the end-to-end technical architecture of Project Sentinel, converting the PRD into an actionable engineering blueprint.

---

## 1. Architecture Document Index

1. [High-Level Technical Architecture](01-high-level-architecture.md) — 5 Principles, 12 System Layers, System Topology.
2. [Frontend & Client Architecture](02-frontend-architecture.md) — Domain structure, State separation, Real-time WebSockets.
3. [API Gateway & Edge Layer](03-api-gateway-and-edge.md) — WAF, Rate limiting tiers, Idempotency, Zero-Trust boundaries.
4. [Core Backend Services & Boundaries](04-backend-services-and-boundaries.md) — 16 Modular backend services, IPC patterns.
5. [Trading & Execution Architecture](05-trading-and-execution-architecture.md) — Trading pipeline, Multi-DEX routing, 7-stage state machine.
6. [Blockchain Adapters & Multi-Chain](06-blockchain-adapters.md) — Universal chain adapter, Multi-RPC health pool scoring.
7. [Market Data & Canonical Event Bus](07-market-data-and-event-bus.md) — Indexer pipeline, Canonical event schemas, Reorg handling.
8. [Token Discovery & Intelligence](08-token-discovery-and-intelligence.md) — Ranking engine, 8 Intelligence sub-engines.
9. [AI Intelligence Layer & Gateway](09-ai-intelligence-layer.md) — Two-tier fact-vs-inference, Model router, Cost controls.
10. [Portfolio, OMS & Smart Alerts](10-portfolio-order-management-and-alerts.md) — Net P&L engine, OMS triggers, Copy trading, Notifications.
11. [Token Launchpad & Reputation](11-launchpad-and-reputation.md) — Launch lifecycle, Anti-rug safety, Verifiable reputation.
12. [Data Platform & Storage](12-data-platform-and-storage.md) — PostgreSQL, Redis, ClickHouse, Object Storage, Search engine.
13. [Infrastructure & CI/CD](13-infrastructure-cicd-and-deployment.md) — Docker, Kubernetes, CI/CD pipeline, Key custody.
14. [Observability & Operations](14-observability-and-operations.md) — Logs, Traces, Metrics, Runbooks, Disaster recovery.
15. [Architecture Evolution & Scale-Out](15-architecture-evolution-and-scale-out.md) — Modular monolith to distributed microservices roadmap.

---

## 2. Definition of Done: 10 Architectural Questions Matrix

Every feature built on Project Sentinel must answer these 10 architectural questions before production sign-off:

| # | Question | Trading Terminal | Token Intelligence | Launchpad | Portfolio / OMS |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Where does this feature live?** | `features/trading/` | `features/token/` | `features/launchpad/` | `features/portfolio/` |
| **2** | **Which service owns it?** | Trading Service (`lib/trading`) | Intelligence Service (`lib/intelligence`) | Launchpad Service (`lib/launchpad`) | Portfolio / OMS (`lib/portfolio`, `lib/order`) |
| **3** | **Which database stores it?** | PostgreSQL (`trade_executions`) | PostgreSQL + ClickHouse | PostgreSQL (`launchpad_tokens`) | PostgreSQL (`orders`, `positions`) |
| **4** | **Which event triggers it?** | `SWAP_REQUESTED`, `SWAP_SIMULATED` | `SWAP`, `TRANSFER`, `TOKEN_CREATED` | `TOKEN_LAUNCH_REQUESTED` | `SWAP_CONFIRMED`, `PRICE_TICK` |
| **5** | **Which blockchain does it touch?** | Solana / EVM DEX Programs | On-chain token accounts & logs | Solana SPL Token / Raydium Vault | On-chain wallet balance RPC |
| **6** | **How does the frontend receive it?** | WebSocket `orders:*` channel | WebSocket `token:*` channel | REST API + WS `launchpad:*` | WebSocket `portfolio:*` |
| **7** | **What happens if the service fails?** | Graceful fallback to secondary DEX | Displays "AI unavailable", facts remain | Launch wizard disabled, existing safe | Cached read-only view shown |
| **8** | **How does it scale?** | Horizontally scaled trade dispatchers | Asynchronous background worker pool | Rate-limited deployment workers | Asynchronous P&L batch compute |
| **9** | **How do we monitor it?** | Execution latency p99, Revert rate | Graph build time, Model cache hit % | Launch failure rate, Escrow locks | P&L compute lag, Trigger accuracy |
| **10**| **How do we secure it?** | Idempotency key, Pre-trade risk caps | Sanitized query inputs, Cache TTL | Mint revocation checks, Escrow locks | SIWS auth token, Least privilege |
