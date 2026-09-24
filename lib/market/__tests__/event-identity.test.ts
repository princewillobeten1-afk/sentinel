import { describe, expect, it } from 'vitest';
import { chainEventId } from '../event-identity';
import { marketEventId, marketEventPipeline, type RawMarketEvent } from '../event-pipeline';

const mint = 'So11111111111111111111111111111111111111112';

describe('canonical Solana event identity', () => {
  it('collapses the same aggregate trade from two providers', () => {
    const birdeye: RawMarketEvent = { eventId: 'birdeye-specific', providerId: 'birdeye_txs_ws',
      mint, eventType: 'SWAP', side: 'BUY', signature: 'sig123', timestamp: new Date().toISOString() };
    const helius: RawMarketEvent = { ...birdeye, eventId: 'helius-specific', providerId: 'helius_logs_scoped' };
    expect(marketEventId(birdeye)).toBe(marketEventId(helius));
    expect(marketEventPipeline.processEvent(birdeye)?.id).toBe(marketEventId(birdeye));
    expect(marketEventPipeline.processEvent(helius)).toBeNull();
  });

  it('keeps distinct proven instructions in the same transaction', () => {
    const first = chainEventId({ signature: 'sig123', mint, kind: 'BUY', instructionIndex: 1 });
    const second = chainEventId({ signature: 'sig123', mint, kind: 'BUY', instructionIndex: 2 });
    const inner = chainEventId({ signature: 'sig123', mint, kind: 'BUY', instructionIndex: 1, innerInstructionIndex: 0 });
    expect(new Set([first, second, inner]).size).toBe(3);
    expect(first).not.toBe(chainEventId({ signature: 'sig123', mint, kind: 'BUY' }));
  });

  it('does not invent an instruction position or chain identity for unsigned ticks', () => {
    expect(chainEventId({ signature: 'sig123', mint, kind: 'BUY', innerInstructionIndex: 0 })).toBeNull();
    const tick: RawMarketEvent = { eventId: 'provider-price-1', providerId: 'birdeye_price_ws',
      mint, eventType: 'PRICE_UPDATE', timestamp: new Date().toISOString() };
    expect(marketEventId(tick)).toBe('provider-price-1');
  });
});
