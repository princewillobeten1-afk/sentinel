import { describe, it, expect, beforeEach } from 'vitest';
import { BlockchainDataValidator, NormalizedMarketEvent } from '../data-validator';

describe('Blockchain Data Quality & Reorg Validator', () => {
  let validator: BlockchainDataValidator;

  beforeEach(() => {
    validator = new BlockchainDataValidator();
  });

  it('accepts valid market events', () => {
    const event: NormalizedMarketEvent = {
      eventId: 'evt_001',
      txHash: '0xmockhash123',
      slot: 289104000,
      blockTimestamp: Date.now(),
      tokenMint: 'So11111111111111111111111111111111111111112',
      tokenDecimals: 9,
      priceUsd: 142.50,
      amountToken: 10,
      volumeUsd: 1425.0,
      side: 'buy',
      sourceProvider: 'raydium_amm',
    };

    const res = validator.validateEvent(event);
    expect(res.valid).toBe(true);
    expect(res.action).toBe('ACCEPT');
  });

  it('deduplicates duplicate event IDs', () => {
    const event: NormalizedMarketEvent = {
      eventId: 'evt_dup_999',
      txHash: '0xmockhash999',
      slot: 289104001,
      blockTimestamp: Date.now(),
      tokenMint: 'So11111111111111111111111111111111111111112',
      tokenDecimals: 9,
      priceUsd: 142.50,
      amountToken: 5,
      volumeUsd: 712.5,
      side: 'buy',
      sourceProvider: 'raydium_amm',
    };

    const first = validator.validateEvent(event);
    expect(first.valid).toBe(true);

    const second = validator.validateEvent(event);
    expect(second.valid).toBe(false);
    expect(second.action).toBe('DEDUPLICATED');
  });

  it('rejects impossible values like negative prices or invalid decimals', () => {
    const invalidEvent: NormalizedMarketEvent = {
      eventId: 'evt_invalid_01',
      txHash: '0xinvalid1',
      slot: 289104002,
      blockTimestamp: Date.now(),
      tokenMint: 'So11111111111111111111111111111111111111112',
      tokenDecimals: -1, // invalid
      priceUsd: -5.0, // impossible negative price
      amountToken: 10,
      volumeUsd: 100,
      side: 'buy',
      sourceProvider: 'raydium_amm',
    };

    const res = validator.validateEvent(invalidEvent);
    expect(res.valid).toBe(false);
    expect(res.action).toBe('REJECT_IMPOSSIBLE_VALUE');
  });

  it('detects chain reorganization when slot rolls backward significantly', () => {
    const event1: NormalizedMarketEvent = {
      eventId: 'evt_slot_500',
      txHash: '0xslot500',
      slot: 289104500,
      blockTimestamp: Date.now(),
      tokenMint: 'So11111111111111111111111111111111111111112',
      tokenDecimals: 9,
      priceUsd: 142.50,
      amountToken: 10,
      volumeUsd: 1425.0,
      side: 'buy',
      sourceProvider: 'raydium_amm',
    };

    validator.validateEvent(event1);

    // Event with slot rolling back by 20 slots
    const rolledBackEvent: NormalizedMarketEvent = {
      eventId: 'evt_slot_480',
      txHash: '0xslot480',
      slot: 289104480,
      blockTimestamp: Date.now(),
      tokenMint: 'So11111111111111111111111111111111111111112',
      tokenDecimals: 9,
      priceUsd: 142.50,
      amountToken: 10,
      volumeUsd: 1425.0,
      side: 'buy',
      sourceProvider: 'raydium_amm',
    };

    const res = validator.validateEvent(rolledBackEvent);
    expect(res.valid).toBe(false);
    expect(res.action).toBe('CHAIN_REORG_DETECTED');
    expect(validator.getReorgCount()).toBe(1);
  });
});
