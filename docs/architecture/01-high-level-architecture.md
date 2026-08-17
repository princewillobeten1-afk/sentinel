# 01 — High-Level Technical Architecture (Sprint 34 §1-3)

## 1. Architecture Philosophy
Project Sentinel is built upon five fundamental architectural principles:

```text
REAL-TIME
   ↓
INTELLIGENT
   ↓
SECURE
   ↓
SCALABLE
   ↓
MODULAR
```

The system is designed to allow the frictionless addition of:
- **New Chains**: Solana, Ethereum, Base, Arbitrum, Monad, Sui.
- **New DEX Venues**: Raydium, Orca, Jupiter, Meteora, Uniswap, Aerodrome.
- **New Liquidity Sources**: CLMMs, DLMMs, Order Books, Private Market Makers.
- **New Intelligence Models**: Dynamic cluster graphs, ML-based wash trading detection, AI narrative engines.
- **New Order Types**: Trailing stops, TWAP, DCA, copy trade triggers.
- **New Launchpad Mechanisms**: Fair launches, bonding curves, locked liquidity pools.

without requiring full-platform rewrites.

---

## 2. 12-Layer System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CLIENT LAYER        Next.js Trading Terminal, Mobile Web, Desktop PWA    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. EDGE LAYER          Cloudflare CDN, WAF, DDoS Mitigation, TLS 1.3 Term.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. API GATEWAY         Kong / Custom Node Gateway (Auth, Rate Limit, CORS)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. APPLICATION LAYER   Modular Monolith Services (Auth, User, Portfolio)    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. TRADING LAYER       Pre-Trade Risk Engine, Quote Router, Signer Dispatch │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. INTELLIGENCE LAYER  8 Deterministic Sub-Engines, Graph Store, Scorer     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. EVENT LAYER         Canonical Event Bus (Redpanda / Kafka / NATS)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 8. BLOCKCHAIN LAYER    Multi-Chain Adapters, Multi-RPC Dynamic Health Pool  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 9. DATA LAYER          PostgreSQL (OLTP), Redis (Cache), ClickHouse (OLAP)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 10. AI LAYER           AI Gateway, Model Router, Token Budgets, Fallback    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 11. INFRASTRUCTURE     Docker Containers, Kubernetes Clusters, AWS / GCP   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 12. OBSERVABILITY      JSON Logger, Distributed Tracing, Prometheus, Grafana│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. High-Level Data Flow & Topology

```text
                         USERS
                           │
             ┌─────────────┴─────────────┐
             │                           │
          WEB APP                    MOBILE APP
             │                           │
             └─────────────┬─────────────┘
                           │
                    EDGE / CDN / WAF
                           │
                    API GATEWAY
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   REST / RPC          WEBSOCKET          AUTH (SIWS)
        │                  │
        └────────────┬─────┘
                     │
              APPLICATION LAYER
                     │
     ┌───────────────┼────────────────┐
     │               │                │
     ▼               ▼                ▼
  TRADING        DISCOVERY       PORTFOLIO
  ENGINE         ENGINE          ENGINE
     │               │                │
     ▼               ▼                ▼
 ORDER ENGINE   INTELLIGENCE     ALERT ENGINE
     │               │                │
     └───────────────┼────────────────┘
                     │
                 EVENT BUS
                     │
        ┌────────────┼─────────────┐
        ▼            ▼             ▼
    INDEXERS      MARKET DATA    AI WORKERS
        │            │             │
        └────────────┼─────────────┘
                     │
               DATA PLATFORM
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
  PostgreSQL       Redis        Analytics DB (ClickHouse)
       │             │             │
       └─────────────┼─────────────┘
                     │
                BLOCKCHAIN
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
    SOLANA        EVM CHAINS     FUTURE CHAINS
```
