# Broadcasting, Monitoring & Reorg Handling

This specification details transaction broadcasting over multi-tier RPCs, block confirmation monitoring, reorganization detection, and replacement handling.

---

## 1. Idempotent Broadcasting & Provider Failover

To prevent duplicate execution while ensuring high availability:

```text
Signed Transaction
       │
       ▼
Broadcaster ──[Verify idempotencyKey has no active on-chain hash]
       │
       ├─► Try Primary RPC (e.g. Helius / Alchemy)
       │     └─ Success → Return txHash
       │     └─ Failure (Timeout / 5xx) ─┐
       ▼                                 ▼
   Secondary RPC (e.g. QuickNode) ◄──────┘
       │     └─ Success → Return txHash
       │     └─ Failure ─┐
       ▼                 ▼
   Tertiary Public Fallback RPC ◄┘
```

---

## 2. Confirmation Policies by Chain

Finality and required block confirmations vary per network:

| Chain | Block Time | Required Confirmations | Finality Model |
|---|---|---|---|
| Solana | ~400ms | 32 slots (`confirmed`) | Optimistic `confirmed` + `finalized` (Root slot) |
| Base (EVM L2) | 2.0s | 12 blocks | Sequencer batch submission + L1 finality |
| Ethereum (L1) | 12.0s | 2 epochs (64 blocks) | Casper FFG / PoS Finality |

---

## 3. Blockchain Reorganization Handling

If a transaction was observed in a block that was subsequently orphaned:

1. `ConfirmationMonitor` detects the transaction is no longer present in the canonical chain at the target block height.
2. Status transitions to `REORG_DETECTED`.
3. The engine waits up to 60 seconds to observe if the transaction was included in the new fork.
4. If not included and nonce has not been consumed, the engine marks the attempt `DROPPED` and notifies the reconciliation service.

---

## 4. Replacement & Speedup Transactions (EVM)

If an EVM transaction is pending beyond the timeout window:
- Supports `REPLACED` state when a replacement transaction with the same nonce and higher gas price is mined.
- Stores both `originalTxHash` and `replacementTxHash` in `ExecutionAttempt` logs.
