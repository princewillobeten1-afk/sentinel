/**
 * `IBondingCurve` — spec §12-14 (bonding curve, requirements, invariants).
 *
 * `BONDING_CURVE_CONSTANTS` and the constant-product formula it parameterizes
 * are imported directly from `lib/launchpad/bonding-curve.ts`'s
 * `BondingCurveEngine` — the reference implementation this contract's math
 * must match bit-for-bit. Nothing in this sprint changes the formula or
 * constants; see docs/contracts/04-bonding-curve.md for a worked example
 * computed by literally calling that engine.
 */

export { BONDING_CURVE_CONSTANTS } from '@/lib/launchpad/bonding-curve';
import type { Address, BigNumberish, BondingCurveState, CurveSimulationResult, TxSignature } from './types';

export interface IBondingCurve {
  getState(bondingCurveAddress: Address): Promise<BondingCurveState>;

  /** Pure quote — no state mutation, matches `BondingCurveEngine.simulateBuy`'s semantics exactly. */
  simulateBuy(bondingCurveAddress: Address, nativeAmountIn: BigNumberish): Promise<CurveSimulationResult>;

  /** Pure quote — matches `BondingCurveEngine.simulateSell`'s semantics exactly. */
  simulateSell(bondingCurveAddress: Address, tokenAmountIn: BigNumberish): Promise<CurveSimulationResult>;

  /** Must reject if `result.priceImpact` implies output below `minTokensOut` (spec §27 slippage protection). */
  buy(bondingCurveAddress: Address, nativeAmountIn: BigNumberish, minTokensOut: BigNumberish, buyer: Address): Promise<{ txSignature: TxSignature; result: CurveSimulationResult }>;

  /** Must reject if output would fall below `minNativeOut`. */
  sell(bondingCurveAddress: Address, tokenAmountIn: BigNumberish, minNativeOut: BigNumberish, seller: Address): Promise<{ txSignature: TxSignature; result: CurveSimulationResult }>;

  /** Mirrors `GraduationManager.checkGraduationStatus` — reserve balance vs. graduation target. */
  checkGraduation(bondingCurveAddress: Address): Promise<boolean>;
}
