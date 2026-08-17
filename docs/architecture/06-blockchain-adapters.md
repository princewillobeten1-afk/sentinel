# 06 — Blockchain Adapter Layer & Multi-Chain Abstraction (Sprint 34 §24, §74-75)

## 1. Multi-Chain Architecture
The blockchain layer isolates chain-specific cryptographic protocols, RPC encoding formats, and transaction serialization behind a universal abstraction layer (`lib/chain/multi-chain.ts`):

```text
                      MULTI-CHAIN REGISTRY
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  Solana Adapter          EVM Adapter           Future Chains
  (Solana Mainnet)     (Ethereum / Base)      (Monad / Sui L1)
        │                      │                      │
  ┌─────┴─────┐          ┌─────┴─────┐          ┌─────┴─────┐
  │ Multi-RPC │          │ Multi-RPC │          │ Multi-RPC │
  │   Pool    │          │   Pool    │          │   Pool    │
  └───────────┘          └───────────┘          └───────────┘
```

---

## 2. Universal Chain Adapter Interface (`lib/chain/adapter.ts`)
Each chain adapter implements:
- `getBalance(address)`: Fetches native coin balance and all SPL / ERC-20 token holdings.
- `getTransaction(hash)`: Returns standardized transaction status, block timestamp, and confirmations.
- `getBlockState()`: Returns current block/slot height and slot duration.
- `estimateFees(transaction)`: Returns base and priority fee estimation in native units.
- `simulateTransaction(transaction)`: Performs on-chain dry-run simulation and logs extraction.
- `broadcastTransaction(signedTransaction)`: Submits signed wire transaction to the RPC pool.
- `subscribeToEvents(address, callback)`: Establishes real-time account/log change listener.

---

## 3. Multi-Node RPC Health Pool & Failover Routing (`lib/chain/rpc-pool.ts`)
To prevent platform outages from single RPC provider degradation, every adapter connects to a dynamic health pool:
- **5-Factor Composite Health Scoring**:
  - `Latency Factor (30 pts)`: Penalized when round-trip latency > 150ms.
  - `Error Rate Factor (40 pts)`: Penalized when 5xx/timeout errors > 1%.
  - `Slot Freshness Factor (20 pts)`: Penalized when node lags > 10 slots behind cluster tip.
  - `Consecutive Failure Penalty (10 pts)`: Stripped to 0 after 3 sequential failures.
- **Failover Routing**: Automatically selects the highest-scoring healthy node, falling back instantly (`Primary -> Secondary -> Tertiary`) if a request errors.
