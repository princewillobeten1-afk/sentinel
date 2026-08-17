import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import { marketEventPipeline, type RawMarketEvent } from '@/lib/market/event-pipeline';
import { signalProcessor } from '@/lib/discovery/signal-processor';
import { BirdeyeClient } from './birdeye-client';
import { HeliusClient } from './helius-client';
import { HeliusLaserstreamClient } from './helius-laserstream';
import { liveMarketCache } from './live-cache';
import { persistMarketEventFireAndForget } from './persistence';
import { resolveTrackedMints, resolveTrackedProgramIds } from './subscription-set';
import { realtimeProcessor } from '@/lib/server/events/processor';
import type { ConnectionHealth } from './types';

export interface StreamManagerHealth {
  birdeye: ConnectionHealth;
  helius: ConnectionHealth;
  laserstream: ConnectionHealth;
  trackedMintCount: number;
  trackedProgramCount: number;
  recentEventCount: number;
  startedAt: string | null;
}

/**
 * Orchestrates the Birdeye, Helius WebSocket, and Helius Laserstream clients,
 * wiring all into the existing `MarketEventPipeline` → live cache →
 * `SignalProcessor` → `market_events` persistence path.
 */
class StreamManager {
  private birdeye: BirdeyeClient | null = null;
  private helius: HeliusClient | null = null;
  private laserstream: HeliusLaserstreamClient | null = null;
  private started = false;
  private startedAt: string | null = null;

  start(): void {
    if (this.started) return;

    if (process.env.MARKET_STREAM_ENABLED === 'false') {
      logger.info('[market-live] stream manager disabled via MARKET_STREAM_ENABLED=false — not connecting.');
      return;
    }

    this.started = true;
    this.startedAt = new Date().toISOString();

    const mints = resolveTrackedMints(env.MARKET_STREAM_TRACKED_MINTS);
    const programIds = resolveTrackedProgramIds(env.MARKET_STREAM_PROGRAM_IDS);

    logger.info('[market-live] starting stream manager with Helius Laserstream', {
      mintCount: mints.length,
      programCount: Object.keys(programIds).length,
      heliusGrpcUrl: env.HELIUS_GRPC_URL,
    });

    // 1. Birdeye Stream
    try {
      this.birdeye = new BirdeyeClient({
        mints,
        onRawEvent: (event) => this.handleRawEvent(event),
        onDegraded: (reason) => marketEventPipeline.triggerFailover(`Birdeye: ${reason}`),
      });
      this.birdeye.connect();
    } catch (err) {
      logger.error('[market-live] failed to start Birdeye client', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. Helius Laserstream Engine (Yellowstone / Geyser High-Speed Stream)
    try {
      this.laserstream = new HeliusLaserstreamClient({
        mints,
        programIds,
        onRawEvent: (event) => this.handleRawEvent(event),
        onDegraded: (reason) => marketEventPipeline.triggerFailover(`Helius Laserstream: ${reason}`),
      });
      this.laserstream.connect();
    } catch (err) {
      logger.error('[market-live] failed to start Helius Laserstream client', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // 3. Helius WebSocket Stream
    try {
      this.helius = new HeliusClient({
        programIds,
        onRawEvent: (event) => this.handleRawEvent(event),
        onDegraded: (reason) => marketEventPipeline.triggerFailover(`Helius WS: ${reason}`),
      });
      this.helius.connect();
    } catch (err) {
      logger.error('[market-live] failed to start Helius WS client', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    // 4. Start mock generator in development mode if requested
    if (process.env.MOCK_REALTIME === 'true') {
      realtimeProcessor.startMockGenerator();
    }
  }

  stop(): void {
    this.birdeye?.stop();
    this.laserstream?.stop();
    this.helius?.stop();
    this.started = false;
  }

  getHealth(): StreamManagerHealth {
    return {
      birdeye: this.birdeye?.getHealth() ?? { state: 'closed', lastMessageAt: null, consecutiveFailures: 0 },
      helius: this.helius?.getHealth() ?? { state: 'closed', lastMessageAt: null, consecutiveFailures: 0 },
      laserstream: this.laserstream?.getHealth() ?? { state: 'closed', lastMessageAt: null, consecutiveFailures: 0 },
      trackedMintCount: resolveTrackedMints(env.MARKET_STREAM_TRACKED_MINTS).length,
      trackedProgramCount: Object.keys(resolveTrackedProgramIds(env.MARKET_STREAM_PROGRAM_IDS)).length,
      recentEventCount: liveMarketCache.getRecentEvents(Number.MAX_SAFE_INTEGER).length,
      startedAt: this.startedAt,
    };
  }

  private handleRawEvent(raw: RawMarketEvent): void {
    const normalized = marketEventPipeline.processEvent(raw);
    if (!normalized) return;

    liveMarketCache.update(normalized);
    signalProcessor.ingestEvent(normalized);
    persistMarketEventFireAndForget(raw, normalized);

    // Forward to Real-Time Event Pipeline (Fast Path + Async Path)
    void realtimeProcessor.processDecodedEvent({
      type: (raw.eventType === 'SWAP' ? 'BUY' : raw.eventType === 'LIQUIDITY_ADD' ? 'LIQUIDITY_ADDED' : 'TOKEN_UPDATE') as any,
      signature: raw.eventId || `evt_${Date.now()}`,
      slot: 0,
      programId: raw.providerId,
      mint: raw.mint,
      amount: raw.volumeUsd ? Number(raw.volumeUsd) : undefined,
      price: raw.priceUsd ? Number(raw.priceUsd) : undefined,
      chainTimestamp: raw.timestamp ? new Date(raw.timestamp).getTime() : Date.now(),
    });

    logger.debug('[market-live] event normalized', {
      mint: normalized.mint,
      eventType: normalized.eventType,
      provider: normalized.provider,
    });
  }
}

const globalForStream = globalThis as unknown as { marketStreamManager?: StreamManager };
export const marketStreamManager = globalForStream.marketStreamManager ?? new StreamManager();
if (process.env.NODE_ENV !== 'production') globalForStream.marketStreamManager = marketStreamManager;
