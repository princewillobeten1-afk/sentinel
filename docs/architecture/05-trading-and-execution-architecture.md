# 05 — Trading, Routing & Multi-DEX Execution Architecture (Sprint 34 §17-27)

## 1. End-to-End Trading Lifecycle Pipeline

```text
User / Frontend
      │ (1. Swap Request: tokenIn, tokenOut, amount, maxSlippage)
      ▼
Trading API (`lib/server/api.ts`)
      │ (2. Input Sanitization & Idempotency Key Validation)
      ▼
Pre-Trade Risk Engine (`lib/security/approval-risk.ts`)
      │ (3. Checks personal loss caps, token blacklist, honeypot flags)
      ▼
Quote Engine (`lib/quote/`)
      │ (4. Fetches raw pool reserves & calculates theoretical output)
      ▼
Multi-DEX Route Engine (`lib/execution/router.ts`)
      │ (5. Compares Raydium, Orca, Jupiter, Uniswap, Aerodrome, Meteora)
      ▼
Transaction Builder (`lib/transaction/`)
      │ (6. Builds binary instruction calldata, compute budget & priority fee)
      ▼
Preflight Simulator (`lib/execution/simulator.ts`)
      │ (7. Simulates on-chain execution; checks revert warnings & slippage)
      ▼
Client / Secure Signer
      │ (8. Cryptographic user wallet signature)
      ▼
Multi-RPC Failover Pool (`lib/chain/rpc-pool.ts`)
      │ (9. Broadcasts serialized transaction to best healthy node)
      ▼
Blockchain Cluster (Solana / EVM)
```

---

## 2. Common DEX Adapter & Execution Abstraction

Every supported decentralized exchange integrates via the uniform `DEXAdapter` interface (`lib/execution/adapters/dex-adapter.ts`):
- `getIdentifier()`: Returns unique venue string (e.g. `RAYDIUM_CLMM`, `ORCA_WHIRLPOOL`, `JUPITER_V6`).
- `getQuote(request)`: Computes expected output, price impact, and compute unit estimate.
- `getLiquidity(tokenAddress)`: Returns total usable pool depth in USD equivalent.
- `buildSwap(quote, slippage)`: Assembles protocol-specific swap instruction calldata.
- `simulateSwap(quote, calldata)`: Validates simulation success and gas usage before broadcast.
- `healthCheck()`: Reports pool responsiveness and latency.

---

## 3. Transaction State Machine & Eventual Reconciliation

All swaps transition through the strict 7-stage deterministic lifecycle (`lib/transaction/state-machine.ts`):
```text
CREATED ──► SIMULATING ──► AUTHORIZED ──► SIGNED ──► SUBMITTED ──► PENDING ──► CONFIRMED
   │             │             │            │            │            │
   ▼             ▼             ▼            ▼            ▼            ▼
[SIM_FAIL]   [REJECTED]   [SIGN_FAIL]  [BC_FAIL]    [CONF_FAIL]  [REVERTED]
```

- **Background Reconciliation Worker (`lib/reconciliation/engine.ts`)**:
  Continuously polls on-chain transaction status for stuck `PENDING` states or false-positive `CONFIRMED` states, adjusting internal database records to `RECONCILED_CORRECTION` and logging security audit records.
