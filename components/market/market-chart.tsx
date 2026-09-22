'use client';

import { CandlestickChart } from '@/components/trading/candlestick-chart';
import type { CandleInterval } from '@/lib/market-data/types';

interface MarketChartProps {
  marketId: string;
  /** Explicit mint; a pool/market ID must never be used as a token address. */
  tokenMint?: string;
  chain?: string;
  symbol?: string;
  initialInterval?: CandleInterval;
}

export function MarketChart({ tokenMint, chain = 'solana', symbol, initialInterval = '1h' }: MarketChartProps) {
  return <CandlestickChart symbol={tokenMint} tokenSymbol={symbol} chain={chain} initialTimeframe={initialInterval} />;
}
