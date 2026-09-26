'use client';

import { CandlestickChart } from '@/components/trading/candlestick-chart';
import type { CandleInterval } from '@/lib/market-data/types';
import type { PriceDisplayUnit } from '@/lib/market/kline-adapter';

interface MarketChartProps {
  marketId: string;
  /** Explicit mint; a pool/market ID must never be used as a token address. */
  tokenMint?: string;
  chain?: string;
  symbol?: string;
  initialInterval?: CandleInterval;
  supply?: number;
  initialDisplayUnit?: PriceDisplayUnit;
  displayUnit?: PriceDisplayUnit;
  onDisplayUnitChange?: (unit: PriceDisplayUnit) => void;
}

export function MarketChart({
  tokenMint,
  chain = 'solana',
  symbol,
  initialInterval = '1h',
  supply,
  initialDisplayUnit = 'mcap',
  displayUnit,
  onDisplayUnitChange,
}: MarketChartProps) {
  return (
    <CandlestickChart
      symbol={tokenMint}
      tokenSymbol={symbol}
      chain={chain}
      initialTimeframe={initialInterval}
      supply={supply}
      initialDisplayUnit={initialDisplayUnit}
      displayUnit={displayUnit}
      onDisplayUnitChange={onDisplayUnitChange}
    />
  );
}
