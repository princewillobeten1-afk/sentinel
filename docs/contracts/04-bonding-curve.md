# 04 — Bonding Curve

Spec §12-14 (bonding curve, requirements, invariants).

## `IBondingCurve`

```ts
interface IBondingCurve {
  getState(bondingCurveAddress: Address): Promise<BondingCurveState>;
  simulateBuy(bondingCurveAddress: Address, nativeAmountIn: BigNumberish): Promise<CurveSimulationResult>;
  simulateSell(bondingCurveAddress: Address, tokenAmountIn: BigNumberish): Promise<CurveSimulationResult>;
  buy(bondingCurveAddress: Address, nativeAmountIn: BigNumberish, minTokensOut: BigNumberish, buyer: Address): Promise<{ txSignature: TxSignature; result: CurveSimulationResult }>;
  sell(bondingCurveAddress: Address, tokenAmountIn: BigNumberish, minNativeOut: BigNumberish, seller: Address): Promise<{ txSignature: TxSignature; result: CurveSimulationResult }>;
  checkGraduation(bondingCurveAddress: Address): Promise<boolean>;
}
```

Full definition: `lib/contracts/bonding-curve.ts`.

## Pricing function (spec §12-13): constant-product AMM

**Not defined fresh here.** `lib/launchpad/bonding-curve.ts`'s `BondingCurveEngine` is the reference implementation this contract's math must match bit-for-bit — a real constant-product (`x·y=k`) simulation that already exists and is already exercised by `lib/launchpad/risk.ts`. `lib/contracts/bonding-curve.ts` imports its constants directly (`export { BONDING_CURVE_CONSTANTS } from '@/lib/launchpad/bonding-curve'`), so this doc can't silently drift from the engine:

| Parameter | Value |
|---|---|
| Initial virtual native reserve | 30 (SOL) |
| Total curve supply | 800,000,000 tokens (80% of a 1,000,000,000 implied total supply) |
| Fee rate | 1% (extracted before the swap on buys, from the output on sells) |
| Initial price | `30 / 800,000,000` = 0.0000000375 SOL/token |
| Graduation | `reserveBalance >= graduationTarget` (`checkGraduation` mirrors `GraduationManager.checkGraduationStatus`) |
| Rounding | JS `number` (double-precision float) at the simulation layer — a real on-chain implementation would need fixed-point/integer arithmetic; see `13-verification-testing-and-simulation.md` for why precision-loss testing is named as a requirement, not yet run |

## Worked example (real, not hand-computed)

Every number below came from actually calling `BondingCurveEngine.simulateBuy`/`simulateSell` (captured while writing this doc — reproducible from a fresh `BondingCurveState { circulatingSupply: '0', reserveBalance: '0', graduationTarget: '85' }`):

**Buy 1 — 5 SOL into a fresh curve:**
```
tokensReceived: 113,304,721.03
priceImpact:    35.72%
feePaid:        0.05 SOL
newPrice:       0.0000000509 SOL/token   (up from 0.0000000375 — the initial-liquidity buy moves price the most)
```

**Buy 2 — another 5 SOL, curve now reflects buy 1:**
```
tokensReceived: 85,191,519.57            (fewer tokens than buy 1 for the same SOL — price already moved)
priceImpact:    30.33%
feePaid:        0.05 SOL
newPrice:       0.0000000663 SOL/token
```

State after both buys: `circulatingSupply = 198,496,240.60`, `reserveBalance = 9.9` SOL. Against `graduationTarget = 85`, this curve has **not** graduated (`checkGraduation` → `false`) — illustrates why a fresh launch needs sustained buy pressure well beyond two 5-SOL buys to reach a realistic graduation target.

**Sell — selling half of buy 1's tokens (56,652,360.52) back, from the post-buy-2 state:**
```
nativeReceived: 3.40 SOL
priceImpact:    16.47%
feePaid:        0.034 SOL
newPrice:       0.0000000554 SOL/token   (down from 0.0000000663, but still above the pre-buy-1 price — the curve doesn't fully "unwind")
```

This is the same worked-example role `docs/performance/benchmarks.md` plays for latency numbers: real output from real code, not an illustrative guess, so the numbers can be regenerated and re-verified rather than trusted on faith.

## Invariants (spec §14)

| Invariant | How it holds today (simulation layer) |
|---|---|
| No negative balances | `Math.max(0.0001, ...)` floors on both `close` price and `low`/token-reserve calculations in the engine |
| No supply creation outside defined rules | `TOTAL_CURVE_SUPPLY` is a fixed constant; `currentTokenReserve = TOTAL_CURVE_SUPPLY - circulatingSupply` — supply can only move between "on the curve" and "circulating," never expand |
| No unauthorized withdrawals | N/A at the simulation layer (no custody exists yet) — becomes an `AccessController`-gated concern once a real contract holds the reserve, see `07-access-control-and-emergency-controller.md` |
| No arithmetic overflow | Not yet tested against real fixed-point/integer arithmetic — flagged in `13-verification-testing-and-simulation.md`, not silently assumed safe |
| No unexpected price manipulation | The formula is deterministic and closed-form given `(circulatingSupply, reserveBalance)` — no operator-settable parameter exists that could secretly bias a quote |
