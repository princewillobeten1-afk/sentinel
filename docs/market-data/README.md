# Sprint 45 — Token Discovery & Market Data Engine

This specification establishes the **canonical market-data layer** for Project Sentinel.

The Market Data Engine turns raw blockchain and indexer data into an authoritative, single source of truth for **Price, Liquidity, Volume, OHLCV, Market Cap, and Market Snapshots**.

```text
Blockchain
   ↓
Indexer
   ↓
Token + Pool Discovery
   ↓
Market Data Engine
   ├── Price
   ├── Liquidity
   ├── Volume
   ├── OHLCV
   ├── Market Cap
   └── Market Snapshots
          ↓
     API + WebSocket
          ↓
      Frontend
```

> **Core Axiom**: This layer is the canonical source of truth for market figures. Downstream intelligence engines consume this layer and must not independently calculate conflicting prices, liquidity, or volume metrics.

---

## Architectural Documentation Index

1. [Market Registry & DEX Adapters](./01-market-registry-and-dex-adapters.md) — Canonical market entity, multi-market per token mapping ($1 \text{ Token} \neq 1 \text{ Market}$), identity uniqueness, status lifecycle (`DISCOVERED`, `ACTIVE`, `INACTIVE`, `SUSPICIOUS`, `DEPRECATED`), and DEX adapter abstractions (Solana, Uniswap V2, Uniswap V3).
2. [Token & Pool Discovery Pipeline](./02-token-and-pool-discovery.md) — On-chain candidate validation, metadata enrichment (isolation of untrusted external feeds), supply tracking (`totalSupply`, `circulatingSupply`, `maxSupply`, `supplyConfidence`).
3. [Pricing, Liquidity & Volume Engines](./03-pricing-liquidity-and-volume-engines.md) — Multi-market price calculation & aggregation (weighted median, volume/liquidity-weighted average, trusted-market selection), source ranking, stale price detection (`STALE`), price divergence detection (`NORMAL`, `WARNING`, `ANOMALOUS`), USD liquidity normalization, multi-window volume (5m, 15m, 1h, 6h, 24h), buy/sell decomposition, and event deduplication.
4. [OHLCV & Market Snapshots](./04-ohlcv-and-market-snapshots.md) — Multi-timeframe OHLCV generator (1m, 5m, 15m, 1h, 4h, 1d), `OPEN` vs `FINAL` candle states, late trade correction & recalculation, periodic market & token snapshots (5s, 15s, 1m, 5m), Market Cap & FDV with supply confidence weighting.
5. [Token Search & Ranking Engine](./05-token-search-and-rankings.md) — Multi-tier token search (exact symbol > exact address > exact name > prefix > partial match > market activity) with cursor pagination, generic ranking framework, trending score algorithm with transparent component breakdown, top gainers, top losers, most liquid, and highest volume feeds.
6. [Realtime Streams & Data Quality](./06-realtime-streams-and-data-quality.md) — WebSocket streaming (`market.price_updated`, `token.market_data_updated`), event coalescing, reconnection & snapshot recovery, and Data Quality Service (`dataQualityScore`, `dataConfidence`, anomaly flags).
7. [API Reference & Storage Architecture](./07-api-reference-and-storage.md) — Complete REST & WebSocket API specification, database schema, index design, cache invalidation, numerical precision standards, calculation versioning, and provenance audit.
