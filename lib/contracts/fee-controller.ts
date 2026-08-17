/**
 * `IFeeController` — spec §20-21 (fee controller, fee transparency).
 *
 * `calculateFeeSplit` is real, tested logic (`lib/contracts/__tests__/fee-split.test.ts`) —
 * everything else in this file is an interface describing an on-chain
 * program that doesn't exist yet.
 */

import type { Address, BigNumberish, TxSignature } from './types';

export interface FeeConfig {
  buyFeeBps: number;
  sellFeeBps: number;
  /** `protocolShareBps + creatorShareBps` must equal 10_000 — enforced by `calculateFeeSplit`. */
  protocolShareBps: number;
  creatorShareBps: number;
}

export interface FeeSplitResult {
  totalFee: BigNumberish;
  protocolAmount: BigNumberish;
  creatorAmount: BigNumberish;
}

/**
 * Splits a fee amount between protocol and creator per `config`'s basis-point
 * shares. Pure, integer-safe (uses `BigInt` — fee amounts are raw token
 * units, not floats): `protocolAmount + creatorAmount` always equals
 * `totalFee` exactly, with any single unit of rounding remainder assigned to
 * the protocol share rather than silently dropped.
 */
export function calculateFeeSplit(feeAmount: BigNumberish, config: FeeConfig): FeeSplitResult {
  if (config.protocolShareBps + config.creatorShareBps !== 10_000) {
    throw new Error(
      `FeeConfig shares must sum to 10000 bps, got ${config.protocolShareBps + config.creatorShareBps}`,
    );
  }

  const total = BigInt(feeAmount);
  const creatorAmount = (total * BigInt(config.creatorShareBps)) / 10_000n;
  const protocolAmount = total - creatorAmount; // remainder goes to protocol, never dropped

  return {
    totalFee: total.toString(),
    protocolAmount: protocolAmount.toString(),
    creatorAmount: creatorAmount.toString(),
  };
}

export interface IFeeController {
  getFeeConfig(scope: 'PLATFORM' | Address): Promise<FeeConfig>;

  /** A natural dual-control candidate — see `lib/server/dual-control.ts` for the off-chain precedent this would eventually mirror. */
  setFeeConfig(scope: 'PLATFORM' | Address, config: FeeConfig, actor: Address): Promise<TxSignature>;

  splitFee(feeAmount: BigNumberish, config: FeeConfig): FeeSplitResult;
}
