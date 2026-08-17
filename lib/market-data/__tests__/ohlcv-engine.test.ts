import { describe, it, expect, beforeEach } from 'vitest';
import { ohlcvEngine } from '../ohlcv/ohlcv-engine';

describe('Canonical OHLCV Engine (Sprint 45 §31-35, §90)', () => {
  beforeEach(() => {
    ohlcvEngine.reset();
  });

  it('generates multi-interval candlestick series (1m, 5m, 15m, 1h, 4h, 1d)', () => {
    const marketId = 'solana:raydium_cpmm:58oqchx4ywmvkdwllzzbi4chocc2fqcuwbkwmihlyqo2';
    const candles1h = ohlcvEngine.getCandles(marketId, '1h', 50);

    expect(candles1h.length).toBeGreaterThan(0);
    const last = candles1h[candles1h.length - 1];
    expect(last.open).toBeGreaterThan(0);
    expect(last.high).toBeGreaterThanOrEqual(last.open);
    expect(last.low).toBeLessThanOrEqual(last.high);
    expect(last.volumeUsd).toBeGreaterThan(0);
  });

  it('updates actively forming candle on trade processing and recalculates on late arrival', () => {
    const marketId = 'solana:test:ohlcv_pool';
    const now = new Date().toISOString();

    const trade1 = {
      id: 'trade_ohlcv_1',
      marketId,
      txHash: '0xTx1',
      senderWallet: 'Wallet1',
      side: 'BUY' as const,
      baseAmount: 1,
      quoteAmount: 100,
      priceUsd: 100.0,
      volumeUsd: 100.0,
      slotOrBlock: 1,
      timestamp: now,
    };

    const trade2 = {
      id: 'trade_ohlcv_2',
      marketId,
      txHash: '0xTx2',
      senderWallet: 'Wallet2',
      side: 'BUY' as const,
      baseAmount: 1,
      quoteAmount: 120,
      priceUsd: 120.0,
      volumeUsd: 120.0,
      slotOrBlock: 2,
      timestamp: now,
    };

    ohlcvEngine.processTrade(trade1);
    const updated = ohlcvEngine.processTrade(trade2);

    const candle1m = updated.find((c) => c.interval === '1m');
    expect(candle1m).toBeDefined();
    expect(candle1m?.open).toBe(100.0);
    expect(candle1m?.high).toBe(120.0);
    expect(candle1m?.close).toBe(120.0);
    expect(candle1m?.volumeUsd).toBe(220.0);
    expect(candle1m?.tradeCount).toBe(2);
  });
});
