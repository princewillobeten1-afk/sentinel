/**
 * `ITreasury` — spec §22-24 (treasury, treasury separation, user funds).
 */

import type { Address, BigNumberish, TxSignature } from './types';

export interface TreasuryBalance {
  asset: Address | 'NATIVE';
  amount: BigNumberish;
}

export interface ITreasury {
  getBalance(asset?: Address | 'NATIVE'): Promise<TreasuryBalance[]>;

  /** A natural dual-control candidate, same as `IFeeController.setFeeConfig` — see `lib/server/dual-control.ts`. */
  withdraw(asset: Address | 'NATIVE', amount: BigNumberish, destination: Address, actor: Address): Promise<TxSignature>;

  /** Records an inbound deposit for accounting — does not move funds itself (the deposit transaction already did). */
  recordDeposit(asset: Address | 'NATIVE', amount: BigNumberish, source: Address, txSignature: TxSignature): Promise<void>;
}
