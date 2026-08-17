# 06 — Fee Controller & Treasury

Spec §20-24 (fee controller, fee transparency, treasury, treasury separation, user funds).

## `IFeeController`

```ts
interface FeeConfig {
  buyFeeBps: number;
  sellFeeBps: number;
  protocolShareBps: number; // protocolShareBps + creatorShareBps must equal 10_000
  creatorShareBps: number;
}

interface IFeeController {
  getFeeConfig(scope: 'PLATFORM' | Address): Promise<FeeConfig>;
  setFeeConfig(scope: 'PLATFORM' | Address, config: FeeConfig, actor: Address): Promise<TxSignature>;
  splitFee(feeAmount: BigNumberish, config: FeeConfig): FeeSplitResult;
}
```

`calculateFeeSplit` (`lib/contracts/fee-controller.ts`) is **real, tested logic** — not just a type declaration. It's `BigInt`-based (fee amounts are raw token units, never floats) and guarantees `protocolAmount + creatorAmount` always equals `totalFee` exactly, assigning any single-unit rounding remainder to the protocol share rather than silently dropping it. `lib/contracts/__tests__/fee-split.test.ts` covers exact splits, odd/remainder amounts, uneven share ratios, zero, and large (`BigInt`-precision) amounts.

### Worked example (real output from `calculateFeeSplit`, asserted by the test suite)

| Fee amount | Split | Protocol gets | Creator gets |
|---|---|---|---|
| 1000 | 50/50 | 500 | 500 |
| 1001 | 50/50 | **501** | 500 — the odd unit goes to protocol, per the rounding rule above |
| 10,000 | 70/30 | 7,000 | 3,000 |

## Fee flow (spec §20)

```text
Trade
 ↓
FeeController.splitFee(feeAmount, config)
 ├── protocolAmount → Treasury
 └── creatorAmount  → creator wallet
```

Percentages live in `FeeConfig`, not hardcoded per call site — `getFeeConfig`/`setFeeConfig` are the single place fee percentages are read/written, matching spec §20's "configurable through governed parameters rather than hardcoded throughout the protocol." `setFeeConfig` is a natural dual-control candidate: `lib/server/dual-control.ts` is the existing off-chain precedent (self-approval is rejected server-side for kill-switch actions) for what an on-chain multisig/dual-control requirement on this method would eventually mirror.

## Fee transparency (spec §21)

Every fee must be visible, calculable, emitted, indexed, and displayed before a trader signs. `FeeConfigUpdated` (`11-event-indexing-and-schema.md`) is the event a UI/indexer reads to know the current config; `splitFee` being a pure, exported function means a client can compute "what will this trade actually cost me" locally, before submitting, using the exact same logic the contract itself would use — not an approximation.

## `ITreasury`

```ts
interface ITreasury {
  getBalance(asset?: Address | 'NATIVE'): Promise<TreasuryBalance[]>;
  withdraw(asset: Address | 'NATIVE', amount: BigNumberish, destination: Address, actor: Address): Promise<TxSignature>;
  recordDeposit(asset: Address | 'NATIVE', amount: BigNumberish, source: Address, txSignature: TxSignature): Promise<void>;
}
```

`withdraw` is the other natural dual-control candidate alongside `setFeeConfig` — both are exactly the class of high-impact, hard-to-undo action `lib/server/dual-control.ts` already exists to gate off-chain.

## Treasury separation (spec §23) & user funds (spec §24)

This interface deliberately has **no method that takes custody of a user's funds outside an explicit trade or launch contribution** — `recordDeposit` records an inbound transfer that already happened on-chain; it never pulls funds. Protocol fees, creator funds, liquidity funds, and user funds are separated by construction: `Treasury` only ever holds the protocol's share (`FeeSplitResult.protocolAmount`), never a creator's share (routed directly, per `splitFee`'s output) or a user's principal (which, for non-custodial trading, never leaves the user's wallet except via `ITradingRouter.executeSwap`/`IBondingCurve.buy`/`sell` — both of which move funds atomically within one transaction, not into platform custody first).
