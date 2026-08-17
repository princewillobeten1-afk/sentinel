# Transaction Construction & Simulation

This specification defines how unsigned transactions are built, gas parameters estimated, approvals checked, and pre-flight simulations executed.

---

## 1. Unsigned Transaction Payload

The TransactionBuilder formats network-specific signing payloads:

### EVM Unsigned Payload
```typescript
interface EvmUnsignedTransaction {
  chainId: number;
  to: string; // Target DEX Router contract
  from: string; // User wallet
  data: string; // Hex-encoded ABI call
  value: string; // Native value (0x0 or Wei)
  gasLimit: string; // Bounded gas limit with safety buffer
  maxFeePerGas?: string; // EIP-1559 Base Fee + Priority Fee
  maxPriorityFeePerGas?: string;
  nonce: number; // Managed Nonce
}
```

### Solana Unsigned Payload
```typescript
interface SolanaUnsignedTransaction {
  chainId: 'solana';
  feePayer: string;
  recentBlockhash: string;
  instructions: {
    programId: string;
    keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
    data: string; // Base58 / Base64
  }[];
  computeUnits: number;
  priorityFeeMicroLamports: number;
}
```

---

## 2. Gas Estimation & Buffering

1. The `GasEstimator` calls node `eth_estimateGas` or Solana `simulateTransaction`.
2. A configurable **safety buffer** is applied:
   $$GasLimit = EstimatedGas \times 1.20$$
3. Gas limits are capped by `MAX_GAS_LIMIT` to prevent out-of-control inflation during network congestion.

---

## 3. Pre-Flight Simulation

Every transaction must simulate successfully before being returned to the user for signature:

```text
Build Unsigned Payload
        ↓
Dry-run Simulation on RPC Node
        ↓
Verification Rules:
  1. Transaction does NOT revert (execution_success = true)
  2. Actual output tokens >= minimumReceived
  3. Gas usage <= estimatedGasLimit
  4. Pool state hasn't moved beyond slippage threshold
```

If simulation fails, a human-readable `SIMULATION_FAILED` error is returned, with internal RPC errors logged to the audit trail.

---

## 4. ERC-20 Allowance & Approval Management

For EVM token swaps:
1. `AllowanceManager.checkAllowance(tokenAddress, owner, spender)`
2. If `currentAllowance < requiredAmount`:
   - State advances to `APPROVAL_REQUIRED`.
   - The platform creates an exact (or bounded) approval transaction payload.
   - User signs and submits approval first; swap execution initiates only after approval confirmation.
