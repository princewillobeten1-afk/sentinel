import { describe, it, expect } from 'vitest';
import { normalizeBirdeyePrice, normalizeBirdeyeTx, normalizeHeliusLogMatch } from '../live/normalizers';
import { resolveTrackedMints, resolveTrackedProgramIds } from '../live/subscription-set';

const MINT = 'So11111111111111111111111111111111111111112';

describe('normalizeBirdeyePrice', () => {
  it('maps a PRICE_DATA message to a PRICE_UPDATE RawMarketEvent', () => {
    const event = normalizeBirdeyePrice(MINT, {
      type: 'PRICE_DATA',
      data: { eventType: 'ohlcv', type: '1m', unixTime: 1_700_000_000, o: 100, h: 101, l: 99, c: 100.5, v: 42 },
    });

    expect(event).not.toBeNull();
    expect(event?.eventType).toBe('PRICE_UPDATE');
    expect(event?.mint).toBe(MINT);
    expect(event?.priceUsd).toBe('100.5');
    expect(event?.volumeUsd).toBe('42');
    expect(event?.providerId).toBe('birdeye_price_ws');
    expect(event?.timestamp).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it('returns null for a non-PRICE_DATA message', () => {
    expect(normalizeBirdeyePrice(MINT, { type: 'PONG' })).toBeNull();
  });

  it('returns null when the close price is missing or non-numeric', () => {
    expect(
      normalizeBirdeyePrice(MINT, { type: 'PRICE_DATA', data: { eventType: 'ohlcv', unixTime: 1, o: 1, h: 1, l: 1, c: NaN, v: 1 } }),
    ).toBeNull();
  });
});

describe('normalizeBirdeyeTx', () => {
  it('maps a TXS_DATA message to a SWAP RawMarketEvent', () => {
    const event = normalizeBirdeyeTx(MINT, {
      type: 'TXS_DATA',
      data: { address: MINT, side: 'buy', priceUsd: 12.5, volumeUsd: 340, blockUnixTime: 1_700_000_100, txHash: 'sig123' },
    });

    expect(event).not.toBeNull();
    expect(event?.eventType).toBe('SWAP');
    expect(event?.eventId).toBe('birdeye_tx_sig123');
    expect(event?.priceUsd).toBe('12.5');
    expect(event?.volumeUsd).toBe('340');
  });

  it('returns null for an unrelated message type', () => {
    expect(normalizeBirdeyeTx(MINT, { type: 'PRICE_DATA', data: {} })).toBeNull();
  });

  it('falls back to a synthetic eventId when txHash is absent', () => {
    const event = normalizeBirdeyeTx(MINT, { type: 'TXS_DATA', data: { blockUnixTime: 5 } });
    expect(event?.eventId).toBe(`birdeye_tx_${MINT}_5`);
  });
});

describe('normalizeHeliusLogMatch', () => {
  it('returns null when the match has no derivable mint (documented v1 limitation)', () => {
    const event = normalizeHeliusLogMatch('sig_abc', 'raydium_amm_v4', { eventType: 'SWAP' });
    expect(event).toBeNull();
  });

  it('builds a RawMarketEvent when a mint is present', () => {
    const event = normalizeHeliusLogMatch('sig_abc', 'orca_whirlpool', {
      eventType: 'LIQUIDITY_ADD',
      mint: MINT,
      priceUsd: '1.23',
    });

    expect(event).not.toBeNull();
    expect(event?.eventType).toBe('LIQUIDITY_ADD');
    expect(event?.mint).toBe(MINT);
    expect(event?.eventId).toBe('helius_sig_abc_orca_whirlpool');
    expect(event?.providerId).toBe('helius_logs_orca_whirlpool');
  });
});

describe('resolveTrackedMints', () => {
  it('falls back to the curated default when env value is empty', () => {
    expect(resolveTrackedMints('')).toContain(MINT);
  });

  it('parses a comma-separated override', () => {
    expect(resolveTrackedMints('mintA, mintB,mintC')).toEqual(['mintA', 'mintB', 'mintC']);
  });
});

describe('resolveTrackedProgramIds', () => {
  it('falls back to the curated default when env value is empty', () => {
    const result = resolveTrackedProgramIds('');
    expect(result.raydium_amm_v4).toBeDefined();
  });

  it('parses a label:programId override list', () => {
    const result = resolveTrackedProgramIds('foo:ProgId1,bar:ProgId2');
    expect(result).toEqual({ foo: 'ProgId1', bar: 'ProgId2' });
  });

  it('ignores malformed entries and falls back when nothing parses', () => {
    const result = resolveTrackedProgramIds('not-a-valid-entry');
    expect(result.raydium_amm_v4).toBeDefined();
  });
});
