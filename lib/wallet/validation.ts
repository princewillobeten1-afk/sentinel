import { PublicKey } from '@solana/web3.js';

/**
 * Pure validation helpers for the self-custodial send flow — devnet-first,
 * see docs/security/threat-model.md's "Wallet transfers" section.
 */

/** A valid base58-encoded Solana public key — catches malformed/wrong-length input for free. */
export function isValidSolanaAddress(address: string): boolean {
  if (!address) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/** Conservative headroom left unspendable on a SOL send, so the account can still pay its own fee. */
export const SOL_FEE_HEADROOM = 0.00001;

export interface BalanceSufficiencyResult {
  sufficient: boolean;
  shortfall: number;
}

/**
 * Checks whether `amount` (plus, for SOL, a fee headroom reserved so the
 * account can still pay its own transaction fee) fits within `balance`.
 * USDC transfers don't consume the token itself for fees (paid in SOL from
 * the same wallet separately), so no headroom applies there.
 */
export function checkBalanceSufficiency(
  amount: number,
  balance: number,
  asset: 'SOL' | 'USDC',
  feeHeadroom: number = SOL_FEE_HEADROOM,
): BalanceSufficiencyResult {
  const required = asset === 'SOL' ? amount + feeHeadroom : amount;
  const shortfall = required - balance;
  return { sufficient: shortfall <= 0, shortfall: Math.max(0, shortfall) };
}

/** Max sendable amount for `asset` given a live `balance`, after any fee headroom. */
export function computeMaxSendable(balance: number, asset: 'SOL' | 'USDC', feeHeadroom: number = SOL_FEE_HEADROOM): number {
  return asset === 'SOL' ? Math.max(0, balance - feeHeadroom) : Math.max(0, balance);
}
