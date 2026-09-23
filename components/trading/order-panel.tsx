'use client';
import { TradingPanel } from './trading-panel';

/** Legacy token-page entry point uses the same server-validated wallet flow as Quick Buy. */
export function OrderPanel({ tokenSymbol, tokenId, currentPriceUsd }: {
  tokenSymbol: string; tokenId: string; currentPriceUsd: number;
}) {
  return <TradingPanel tokenSymbol={tokenSymbol} tokenMint={tokenId} tokenPriceUsd={String(currentPriceUsd)} />;
}
