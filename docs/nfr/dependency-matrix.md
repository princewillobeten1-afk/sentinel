# Project Sentinel: Service Dependency & Failure Impact Matrix (Sprint 33 §20-21)

This matrix maps every platform service to its dependencies, failure impacts, fallback mechanisms, and recovery procedures.

---

## Service Dependency Map

### 1. Trading API
- **Dependencies**: PostgreSQL Database, Pre-Trade Risk Engine, Solana RPC Pool, Transaction State Machine.
- **Failure Impact of Upstream AI/Intelligence**: **None**. Core swap execution is decoupled from AI risk recommendations.
- **Fallback**: Route to secondary DEX adapter (e.g. Raydium fallback to Orca/Meteora) if primary quote router fails.
- **Recovery Procedure**: Automatic RPC retry with full jitter; kill switch activation if systemic pool drain detected.

### 2. Market Data Stream
- **Dependencies**: WebSocket Gateway, Solana Geyser / Log Stream, Pyth / Birdeye Price Oracles.
- **Failure Impact**: Price display switches to "Data Delayed" banner.
- **Fallback**: Fallback to secondary pricing oracle (DexScreener API / on-chain pool reserve calculation).
- **Recovery Procedure**: Automatic WebSocket reconnect with exponential backoff and slot catch-up backfill.

### 3. Token Intelligence Engine
- **Dependencies**: Graph Clustering Store, Holder Data Indexer, On-Chain Contract Parser.
- **Failure Impact**: Intelligence score displays "AI analysis unavailable"; core market viewing and trading remain active.
- **Fallback**: Display verified on-chain facts without statistical inference.
- **Recovery Procedure**: Circuit breaker half-open probing and feature store cache invalidation.

### 4. Authentication & Wallet Service
- **Dependencies**: SIWS Cryptographic Verifier, Session Store, MFA TOTP Engine.
- **Failure Impact**: Users cannot log in or sign transactions.
- **Fallback**: Local read-only cached portfolio viewing.
- **Recovery Procedure**: Restart auth session worker; emergency session revocation if compromise detected.
