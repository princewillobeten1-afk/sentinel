import { eventBus } from './event-bus';
import { EventNormalizer } from './normalizer';
import { EVENT_TYPES, type NormalizedRealtimeEvent } from './event-types';
import { BlockchainDecoder, type DecodedBlockchainEvent } from '../helius/decoder';
import { birdeyeEnrichment } from '../birdeye/enrichment';
import { realtimeRepository } from '../db/realtime-repository';
import { logger } from '../logger';

export class RealtimeEventProcessor {
  private static instance: RealtimeEventProcessor;

  private constructor() {}

  public static getInstance(): RealtimeEventProcessor {
    if (!RealtimeEventProcessor.instance) {
      RealtimeEventProcessor.instance = new RealtimeEventProcessor();
    }
    return RealtimeEventProcessor.instance;
  }

  /**
   * Main entry point for raw blockchain messages from Helius LaserStream or WebSocket.
   */
  public async processRawTransaction(tx: any, source: 'helius_laserstream' | 'helius_ws' | 'mock' = 'helius_laserstream'): Promise<void> {
    const receivedTimestamp = Date.now();
    const decodedEvents = BlockchainDecoder.decodeTransaction(tx);

    for (const decoded of decodedEvents) {
      await this.processDecodedEvent(decoded, source, receivedTimestamp);
    }
  }

  /**
   * Processes a decoded blockchain event through Fast Path and Async Path.
   */
  public async processDecodedEvent(
    decoded: DecodedBlockchainEvent,
    source: 'helius_laserstream' | 'helius_ws' | 'mock' = 'helius_laserstream',
    receivedTimestamp: number = Date.now()
  ): Promise<void> {
    // 1. Normalize
    const event = EventNormalizer.normalize(decoded, source, receivedTimestamp);

    // 2. Deduplication check
    const isNew = eventBus.claimEvent(event.id);
    if (!isNew) {
      return; // Skip duplicate event
    }

    // 3. FAST PATH: Publish immediately to Redis and WebSocket subscribers
    await eventBus.publish(event);

    logger.debug('[processor] fast path broadcasted', {
      type: event.type,
      mint: event.mint,
      id: event.id,
      latencyMs: event.latency?.totalDetectionLatencyMs,
    });

    // 4. ASYNC PATH: Background enrichment & persistent database writes (never blocks real-time delivery)
    this.handleAsyncPath(event);
  }

  private handleAsyncPath(event: NormalizedRealtimeEvent): void {
    // A. Birdeye market data enrichment
    if (event.mint && (event.type === EVENT_TYPES.TOKEN_CREATED || event.type === EVENT_TYPES.POOL_CREATED)) {
      birdeyeEnrichment.enqueue(event.mint);
    }

    // B. PostgreSQL persistence
    if (event.type === EVENT_TYPES.TOKEN_CREATED && event.mint) {
      void realtimeRepository.saveToken({
        mint: event.mint,
        name: event.name || `Token ${event.mint.slice(0, 4)}`,
        symbol: event.symbol || event.mint.slice(0, 4).toUpperCase(),
        platform: event.dex,
        firstSeenSlot: event.slot,
        firstSignature: event.signature,
        priceUsd: event.priceUsd,
        liquidityUsd: event.liquidityUsd,
      });
    } else if ((event.type === EVENT_TYPES.BUY || event.type === EVENT_TYPES.SELL) && event.mint && event.signature) {
      void realtimeRepository.saveTrade({
        signature: event.signature,
        mint: event.mint,
        wallet: event.wallet,
        side: event.type === EVENT_TYPES.BUY ? 'BUY' : 'SELL',
        amount: event.amount,
        amountSol: event.amountSol,
        priceUsd: event.priceUsd,
        slot: event.slot,
        timestamp: new Date(event.timestamp).toISOString(),
      });
    }
  }

  /**
   * Starts simulated development events if MOCK_REALTIME is enabled (Section 32).
   */
  public startMockGenerator(): void {
    logger.info('[processor] starting mock real-time event generator for development');

    const MOCK_MINTS = [
      { mint: 'PumpTest1111111111111111111111111111111111', symbol: 'PEPE2', name: 'Pepe 2.0 Solana', dex: 'pump.fun' },
      { mint: 'PumpTest2222222222222222222222222222222222', symbol: 'SENTINEL', name: 'Sentinel AI Pulse', dex: 'raydium' },
      { mint: 'PumpTest3333333333333333333333333333333333', symbol: 'HYPER', name: 'Hyper Velocity', dex: 'meteora' },
    ];

    let count = 0;
    setInterval(() => {
      count++;
      const item = MOCK_MINTS[count % MOCK_MINTS.length];
      const isCreate = count % 5 === 0;

      if (isCreate) {
        const newMint = `MockToken${Date.now()}${Math.random().toString(36).substring(7)}`;
        void this.processDecodedEvent(
          {
            type: EVENT_TYPES.TOKEN_CREATED,
            signature: `sig_mock_${Date.now()}`,
            slot: 300000000 + count,
            programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
            mint: newMint,
            name: `Super Gem ${count}`,
            symbol: `GEM${count}`,
            wallet: `Wal${Date.now().toString(36)}`,
            dex: 'pump.fun',
            chainTimestamp: Date.now() - 150,
          },
          'mock'
        );
      } else {
        const side = Math.random() > 0.4 ? EVENT_TYPES.BUY : EVENT_TYPES.SELL;
        void this.processDecodedEvent(
          {
            type: side,
            signature: `sig_trade_${Date.now()}_${count}`,
            slot: 300000000 + count,
            programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
            mint: item.mint,
            name: item.name,
            symbol: item.symbol,
            wallet: `Trader${Math.floor(Math.random() * 999)}`,
            dex: item.dex,
            amount: Math.floor(Math.random() * 50000) + 1000,
            amountSol: Number((Math.random() * 3.5 + 0.1).toFixed(3)),
            price: Number((Math.random() * 0.05 + 0.001).toFixed(6)),
            chainTimestamp: Date.now() - 100,
          },
          'mock'
        );
      }
    }, 4000);
  }
}

export const realtimeProcessor = RealtimeEventProcessor.getInstance();
