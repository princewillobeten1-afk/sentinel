import { BondingCurveState, SimulationResult } from './types';

/**
 * Canonical bonding-curve constants — also the values `docs/contracts/04-bonding-curve.md`
 * (Sprint 36) documents `IBondingCurve` against. Exported so that doc is
 * import-consistent with this engine rather than a hand-copied restatement
 * that could silently drift.
 */
export const BONDING_CURVE_CONSTANTS = {
  VIRTUAL_NATIVE_RESERVE: 30, // e.g. 30 SOL initial virtual reserve
  TOTAL_CURVE_SUPPLY: 800_000_000, // 800M tokens for sale on curve (80% of 1B supply)
  FEE_RATE: 0.01, // 1% fee
} as const;

/**
 * Implements a standard Constant Product AMM curve (x * y = k) for the Bonding Curve phase.
 * We simulate a virtual liquidity pool where tokens are minted along the curve until Graduation.
 */
export class BondingCurveEngine {
  private readonly VIRTUAL_NATIVE_RESERVE = BONDING_CURVE_CONSTANTS.VIRTUAL_NATIVE_RESERVE;
  private readonly TOTAL_CURVE_SUPPLY = BONDING_CURVE_CONSTANTS.TOTAL_CURVE_SUPPLY;
  private readonly FEE_RATE = BONDING_CURVE_CONSTANTS.FEE_RATE;

  public simulateBuy(state: BondingCurveState, nativeAmountIn: number): SimulationResult {
    // Current reserves
    const currentTokenReserve = this.TOTAL_CURVE_SUPPLY - parseFloat(state.circulatingSupply);
    const currentNativeReserve = parseFloat(state.reserveBalance) + this.VIRTUAL_NATIVE_RESERVE;

    // Fee extraction
    const fee = nativeAmountIn * this.FEE_RATE;
    const amountInAfterFee = nativeAmountIn - fee;

    // Constant product formula: dx = (x * dy) / (y + dy)
    // x = tokens, y = native
    const tokensOut = (currentTokenReserve * amountInAfterFee) / (currentNativeReserve + amountInAfterFee);
    
    // Price impact
    const priceBefore = currentNativeReserve / currentTokenReserve;
    const newNativeReserve = currentNativeReserve + amountInAfterFee;
    const newTokenReserve = currentTokenReserve - tokensOut;
    const priceAfter = newNativeReserve / newTokenReserve;
    const priceImpact = (priceAfter - priceBefore) / priceBefore;

    return {
      tokensReceived: tokensOut.toString(),
      priceImpact,
      feePaid: fee.toString(),
      newPrice: priceAfter.toString()
    };
  }

  public simulateSell(state: BondingCurveState, tokenAmountIn: number): SimulationResult {
    const currentTokenReserve = this.TOTAL_CURVE_SUPPLY - parseFloat(state.circulatingSupply);
    const currentNativeReserve = parseFloat(state.reserveBalance) + this.VIRTUAL_NATIVE_RESERVE;

    // Constant product formula: dy = (y * dx) / (x + dx)
    const nativeOut = (currentNativeReserve * tokenAmountIn) / (currentTokenReserve + tokenAmountIn);
    
    const fee = nativeOut * this.FEE_RATE;
    const nativeOutAfterFee = nativeOut - fee;

    // Price impact
    const priceBefore = currentNativeReserve / currentTokenReserve;
    const newNativeReserve = currentNativeReserve - nativeOut;
    const newTokenReserve = currentTokenReserve + tokenAmountIn;
    const priceAfter = newNativeReserve / newTokenReserve;
    // Price goes down, impact is negative
    const priceImpact = Math.abs((priceAfter - priceBefore) / priceBefore);

    return {
      nativeReceived: nativeOutAfterFee.toString(),
      priceImpact,
      feePaid: fee.toString(),
      newPrice: priceAfter.toString()
    };
  }
}
