# 07 — Market Data Pipeline & Canonical Event Bus (Sprint 34 §28-33)

## 1. End-to-End Market Data Streaming Pipeline

```text
Solana Geyser / RPC Node Stream
             │
             ▼
Indexer Ingestion Cluster (`lib/market/solana-provider.ts`)
             │ (Raw Blocks, Logs, Program Instructions)
             ▼
Instruction Decoder & Price Normalizer (`lib/market/live-normalizers.ts`)
             │ (Translates Raydium/Orca swap logs into USD volume & prices)
             ▼
Data Quality & Reorg Validator (`lib/market/data-validator.ts`)
             │ (Deduplication, impossible value filter, slot rollback catch)
             ▼
Canonical Event Bus (`lib/events/bus.ts` / Kafka / Redpanda)
             │
     ┌───────┴───────┬───────────────┬───────────────┐
     ▼               ▼               ▼               ▼
Market Cache    Discovery       Intelligence    Alerts & WS
  (Redis)        Worker          Pipeline         Gateway
     │
     ▼
WebSocket Broadcast Cluster (`lib/ws/protocol.ts`)
     │
     ▼
Connected Traders & Web Terminal
```

---

## 2. Canonical Event Schema (`lib/events/types.ts`)

Every event across the platform adheres to a single canonical JSON envelope:

```json
{
  "eventId": "evt_sol_289104000_swap_01",
  "eventType": "SWAP",
  "version": "1.0.0",
  "chain": "solana",
  "slot": 289104000,
  "transactionHash": "5Kj8xWv...",
  "timestamp": "2026-08-15T20:30:00.000Z",
  "source": "solana_geyser",
  "payload": {
    "tokenMint": "So11111111111111111111111111111111111111112",
    "dexVenue": "RAYDIUM_CLMM",
    "side": "buy",
    "priceUsd": 142.50,
    "amountToken": 10.5,
    "volumeUsd": 1496.25,
    "maker": "7qbRF6...",
    "taker": "58oQCh..."
  }
}
```

---

## 3. Data Ingestion Hygiene & Reorganization Protection
- **Deduplication Gate**: Keeps a sliding window of recent `eventId`s (50,000 events) to drop duplicate RPC broadcasts.
- **Impossible Value Filter**: Drops negative prices, zero decimals, and anomalous timestamp drift (>5 minutes).
- **Chain Reorganization Detection**: If an incoming slot rolls backward by >5 slots relative to the highest seen slot, the validator flags `CHAIN_REORG_DETECTED`, triggers indexer state rollback, and alerts downstream analytics.
