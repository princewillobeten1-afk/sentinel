import type { DiscoveryToken } from '@/lib/discovery/types';
import type { MetricEvidence } from '@/lib/discovery/types';
import type { MonetaryValue } from '@/lib/portfolio/types';

export interface TradeSidebarSnapshot extends Partial<DiscoveryToken> {
  mint: string;
  buyVolume5mUsd?: number | null;
  sellVolume5mUsd?: number | null;
  /** Percentage of pool liquidity verified as locked. This is not an LP-burn claim. */
  lpLockedPct?: number | null;
  liquidityEvidence?: MetricEvidence;
  activityEvidence?: MetricEvidence;
  funding?: { address: string; amountSol: number; signature: string; fundedAt: string; name?: string } | null;
  fundingEvidence?: MetricEvidence;
  devBalanceSol?: number | null;
  devBalanceEvidence?: MetricEvidence;
  imageReuse?: { matches: { mint: string; name?: string; symbol?: string }[]; evidence: MetricEvidence; coverage: 'indexed-exact-url' };
}

/** Wallet-specific data must never enter the public token.card topic. */
export interface TradeWalletPosition {
  wallet: string; mint: string; quantity: number | null; balanceSol: number | null;
  boughtUsd: number | null; soldUsd: number | null; holdingUsd: number | null; pnlUsd: number | null;
  balanceEvidence: MetricEvidence; pnlEvidence: MetricEvidence;
}

export function measuredNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function measuredUsd(value: MonetaryValue | undefined): number | null {
  return value && !['UNKNOWN', 'UNAVAILABLE'].includes(value.status) ? measuredNumber(value.usd) : null;
}

export function summarizePosition(position: TradeWalletPosition | null) {
  return {
    quantity: measuredNumber(position?.quantity),
    boughtUsd: measuredNumber(position?.boughtUsd),
    soldUsd: measuredNumber(position?.soldUsd),
    holdingUsd: measuredNumber(position?.holdingUsd),
    pnlUsd: measuredNumber(position?.pnlUsd),
  };
}

export const TRADE_PRESETS = [
  { amounts: [0.01, 0.1, 1, 10], slippage: 0.5 },
  { amounts: [0.05, 0.25, 0.5, 2], slippage: 1 },
  { amounts: [0.1, 0.5, 1, 5], slippage: 2 },
];
