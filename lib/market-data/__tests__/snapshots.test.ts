import { describe, it, expect, beforeEach } from 'vitest';
import { snapshotEngine } from '../snapshots/snapshot-engine';

describe('Market & Token Snapshot Engine (Sprint 45 §36-43)', () => {
  beforeEach(() => {
    snapshotEngine.reset();
  });

  it('computes token snapshot with Market Cap and multi-window price changes', () => {
    const sentMint = 'So11111111111111111111111111111111111111112';
    const snapshot = snapshotEngine.getTokenSnapshot(sentMint);

    expect(snapshot.tokenId).toBe(sentMint);
    expect(snapshot.priceUsd).toBeGreaterThan(0);
    expect(snapshot.marketCapUsd).toBeGreaterThan(1_000_000);
    expect(snapshot.marketCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.confidence).toBeGreaterThan(0.9);
  });

  it('safely calculates price change with zero-division protection', () => {
    const change = snapshotEngine.computePriceChange(150, 100);
    expect(change).toBe(50.0);

    const zeroPrev = snapshotEngine.computePriceChange(150, 0);
    expect(zeroPrev).toBe(0);
  });
});
