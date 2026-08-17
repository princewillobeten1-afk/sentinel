# Execution Service Architecture

The Swap Execution Engine is the authoritative system boundary turning simulated quotes into confirmed on-chain transactions.

---

## 1. Execution Pipeline

```text
Trading Terminal UI
       │
       ▼ (1. POST /api/v1/executions)
Execution Service ──[Idempotency Key Verification]
       │
       ├─► QuoteValidator (Integrity, Expiration, Token Pair, Amount)
       ├─► RouteEngine (Direct, Multi-Hop, Multi-Market Scoring)
       ├─► TransactionBuilder (DEX Adapters: Uniswap V2/V3, Solana)
       ├─► Simulator (Pre-flight Simulation, Revert Decoding)
       └─► SafetyValidator (Slippage Bounds, Quote Drift, Gas Balance, Blocklist)
       │
       ▼ (2. Return Unsigned Payload & Status: READY_FOR_SIGNATURE)
User's Wallet Signs (Phantom, Metamask, Solflare, etc.)
       │
       ▼ (3. POST /api/v1/executions/:id/submit)
Execution Service ──[Signature Verification]
       │
       ├─► Broadcaster (Idempotent Broadcast with Multi-Tier RPC Failover)
       ├─► ConfirmationMonitor (Confirmations, Finality, Reorg Detection)
       ├─► ReconciliationService (Balance Sync, Portfolio Update, Receipt)
       └─► ExecutionAuditService (Append-only Event Log)
       │
       ▼ (4. Realtime Status Stream & Final Execution Receipt)
Trading Terminal UI
```

---

## 2. Component Responsibilities

| Subsystem | Responsibility |
|---|---|
| `QuoteValidator` | Verifies server-issued quote signature, expiration (15s TTL), token pair, input amount, and chain match. |
| `RouteEngine` | Discovers direct, multi-hop, and multi-market swap routes and ranks them by net expected output and risk. |
| `TransactionBuilder` | Formats unsigned payloads with exact calldata, gas limits, and nonces for EVM or instruction accounts for Solana. |
| `Simulator` | Runs dry-run simulation against RPC node or sandbox before requesting user signature. |
| `SafetyValidator` | Enforces server-side slippage limits, quote drift tolerance, native token gas sufficiency, and contract allowlists. |
| `GasEstimator` | Computes gas limits, base fees, priority fees, and enforces bounded gas safety buffers. |
| `AllowanceManager` | Checks ERC-20 allowances and manages exact/bounded approval lifecycles. |
| `Broadcaster` | Broadcasts raw signed transactions with multi-tier RPC failover (Primary → Secondary → Tertiary). |
| `ConfirmationMonitor` | Polls block inclusions up to required confirmation threshold and detects chain reorganizations (`REORG_DETECTED`). |
| `ReconciliationService` | Fetches post-trade on-chain balances, calculates effective execution price, and issues `ExecutionReceipt`. |
| `AuditService` | Records append-only immutable event logs for every state transition and administrative action. |
| `ProtectionService` | Evaluates MEV risk and routes orders through private RPCs or protected relays when applicable. |
| `ExecutionKillSwitch` | Provides administrative circuit breaking and emergency token/contract execution blocklists. |

---

## 3. Execution Request & Intent Lifecycles

### ExecutionRequest
```typescript
interface ExecutionRequest {
  requestId: string;
  idempotencyKey: string;
  userId: string;
  walletAddress: string;
  chainId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number;
  quoteId: string;
  createdAt: string;
  expiresAt: string;
}
```

### Execution Intent States
1. `CREATED`: Execution request accepted and validated.
2. `ROUTE_SELECTED`: Optimal DEX route chosen.
3. `TRANSACTION_BUILT`: Unsigned transaction payload generated.
4. `SIMULATED`: Pre-flight simulation passed successfully.
5. `READY_FOR_SIGNATURE`: Payload dispatched to user's wallet.
6. `SIGNED`: Wallet signature received and verified.
7. `SUBMITTED`: Dispatched to node/mempool broadcaster.
8. `PENDING`: Transaction visible in mempool.
9. `CONFIRMING`: Transaction included in block, accumulating block confirmations.
10. `CONFIRMED`: Finality threshold met, balances reconciled, execution receipt issued.
11. `FAILED`: Terminal error (revert, timeout, slippage exceeded, insufficient gas, user rejected).
