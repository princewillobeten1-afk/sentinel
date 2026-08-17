import { describe, it, expect } from 'vitest';
import { EventNormalizer } from '../normalizer';
import { BlockchainDecoder } from '../../helius/decoder';
import { eventBus } from '../event-bus';
import { EVENT_TYPES } from '../event-types';
import { PROTOCOL_PROGRAMS } from '../../helius/protocols';

describe('Real-Time Solana Token Feed — Core Pipeline', () => {
  describe('EventNormalizer', () => {
    it('creates deterministic event IDs', () => {
      const id1 = EventNormalizer.createEventId('sig123', 'BUY', 'So11111111111111111111111111111111111111112');
      const id2 = EventNormalizer.createEventId('sig123', 'BUY', 'So11111111111111111111111111111111111111112');
      expect(id1).toBe('sig123:BUY:So11111111111111111111111111111111111111112');
      expect(id1).toBe(id2);
    });

    it('normalizes decoded events with timestamps and sequence numbers', () => {
      const normalized = EventNormalizer.normalize(
        {
          type: EVENT_TYPES.TOKEN_CREATED,
          signature: 'sig_test_1',
          slot: 250000,
          programId: PROTOCOL_PROGRAMS.pumpfun.programId,
          mint: 'TestMint111111111111111111111111111111111',
          dex: 'pump.fun',
          chainTimestamp: 1700000000000,
        },
        'helius_laserstream',
        1700000000100
      );

      expect(normalized.type).toBe('TOKEN_CREATED');
      expect(normalized.sequence).toBeGreaterThan(0);
      expect(normalized.source).toBe('helius_laserstream');
      expect(normalized.commitment).toBe('processed');
      expect(normalized.latency?.chainTimestamp).toBe(1700000000000);
      expect(normalized.latency?.receivedTimestamp).toBe(1700000000100);
    });
  });

  describe('BlockchainDecoder', () => {
    it('decodes Pump.fun token creation and trades', () => {
      const mockTx = {
        signature: 'sig_pump_create',
        slot: 280000,
        blockTime: 1710000000,
        transaction: {
          message: {
            accountKeys: ['UserWallet1111111111111111111111111111111', 'PumpMint1111111111111111111111111111111111', PROTOCOL_PROGRAMS.pumpfun.programId],
          },
        },
        meta: {
          logMessages: ['Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]', 'Program log: Instruction: Create', 'Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success'],
        },
      };

      const events = BlockchainDecoder.decodeTransaction(mockTx);
      expect(events.length).toBe(1);
      expect(events[0].type).toBe(EVENT_TYPES.TOKEN_CREATED);
      expect(events[0].dex).toBe('pump.fun');
      expect(events[0].mint).toBe('PumpMint1111111111111111111111111111111111');
    });

    it('decodes Raydium liquidity and swaps', () => {
      const mockTx = {
        signature: 'sig_ray_swap',
        slot: 280010,
        blockTime: 1710000010,
        transaction: {
          message: {
            accountKeys: ['TraderWallet1111111111111111111111111111', 'RaydiumMint1111111111111111111111111111111', PROTOCOL_PROGRAMS.raydiumAmmV4.programId],
          },
        },
        meta: {
          logMessages: ['Program 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8 invoke [1]', 'Program log: ray_log: swapBaseIn', 'Program 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8 success'],
        },
      };

      const events = BlockchainDecoder.decodeTransaction(mockTx);
      expect(events.length).toBe(1);
      expect(events[0].type).toBe(EVENT_TYPES.BUY);
      expect(events[0].dex).toBe('raydium');
    });
  });

  describe('EventBus & Deduplication', () => {
    it('deduplicates identical blockchain events', () => {
      const testId = `dedup_test_${Date.now()}`;
      const firstClaim = eventBus.claimEvent(testId);
      const secondClaim = eventBus.claimEvent(testId);

      expect(firstClaim).toBe(true);
      expect(secondClaim).toBe(false); // Rejected duplicate
    });

    it('stores and retrieves missed events via ring buffer', async () => {
      const event1 = EventNormalizer.normalize({
        type: EVENT_TYPES.BUY,
        signature: `sig_seq_1_${Date.now()}`,
        slot: 100,
        programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
        mint: 'TestMintSeq1',
      });

      const initialSeq = event1.sequence;
      await eventBus.publish(event1);

      const missed = eventBus.getEventsAfter(initialSeq - 1);
      expect(missed.some((e) => e.sequence === initialSeq)).toBe(true);
    });
  });
});
