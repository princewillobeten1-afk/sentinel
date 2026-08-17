# Reconciliation & Execution Receipts

Following block confirmation, the platform performs balance reconciliation, calculates the effective executed price, and issues an authoritative `ExecutionReceipt`.

---

## 1. Balance Reconciliation Flow

```text
Transaction Confirmed On-Chain
       │
       ▼
Fetch Realtime On-Chain Wallet Balances
       │
       ├─► Update User Portfolio & Token Positions
       ├─► Verify Token Delta matches Event Logs
       └─► Calculate Discrepancy (if any)
       │
       ▼
Emit ExecutionReceipt & Refresh UI Balances
```

---

## 2. Effective Price & Execution Quality

### Effective Price Calculation
$$EffectivePrice = \frac{ActualAmountOut}{ActualAmountIn}$$

### Actual vs Expected Comparison
- **Deviation**: $\Delta_{deviation} = ActualAmountOut - ExpectedAmountOut$
- **Deviation Percentage**: $\frac{Actual - Expected}{Expected} \times 100\%$
- Stored on the `ExecutionQuality` record to feed execution intelligence and router optimization metrics.

---

## 3. Normalized ExecutionReceipt Structure

```typescript
export interface ExecutionReceipt {
  executionId: string;
  transactionHash: string;
  chainId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  expectedOutput: string;
  effectivePrice: string;
  priceDeviationPct: number;
  networkFeeUsd: number;
  dexFeeUsd: number;
  platformFeeUsd: number;
  routeTaken: string[];
  blockNumberOrSlot: number;
  timestamp: string;
}
```
