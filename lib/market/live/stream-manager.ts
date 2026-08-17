import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import { marketEventPipeline, type RawMarketEvent } from '@/lib/market/event-pipeline';
import { signalProcessor } from '@/lib/discovery/signal-processor';
import { BirdeyeClient } from './birdeye-client';
import { HeliusClient } from './helius-client';
import { liveMarketCache } from './live-cache';
import { persistMarketEventFireAndForget } from './persistence';
import { resolveTrackedMints, resolveTrackedProgramIds } from './subscription-set';
import { realtimeProcessor } from '@/lib/server/events/processor';
import type { ConnectionHealth } from './types';

export interface StreamManagerHealth {
  birdeye: ConnectionHealth;
  helius: ConnectionHealth;
  trackedMintCount: number;
  trackedProgramCount: number;
  recentEventCount: number;
  startedAt: string | null;
}

/**
 * Orchestrates the Birdeye and Helius WebSocket clients, wiring both into the
 * existing `MarketEventPipeline` → live cache → `SignalProcessor` →
 * `market_events` persistence path, and onward to the realtime fast path.
 *
 * A third client, `HeliusLaserstreamClient`, was removed rather than kept: it
 * performed a single `fetch` to a `/health` URL, set `isConnected = true`
 * regardless of the outcome, and logged "connected to Helius Laserstream
 * engine". It had no subscription and no read loop, and the one method that
 * could emit an event had no callers anywhere in the repository — so it
 * produced nothing while reporting itself healthy. Real gRPC LaserStream is a
 * genuine option, but it has to be built, not simulated.
 */
class StreamManager {
  private birdeye: BirdeyeClient | null = null;
  private helius: HeliusClient | null = null;
  private started = false;
  private startedAt: string | null = null;

  start(): void {
    if (this.started) return;

    // The mock generator is checked *before* the enable flag, deliberately.
    // It exists so the real-time frontend can be developed without touching
    // Helius or Birdeye (brief §32) — gating it behind the switch that turns
    // those paid connections on would defeat its entire purpose, and left the
    // only offline development path unreachable.
    if (process.env.MOCK_REALTIME === 'true') {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[market-live] MOCK_REALTIME=true ignored in production — refusing to emit synthetic events.');
      } else {
        logger.warn('[market-live] MOCK_REALTIME=true — emitting synthetic events, not live chain data.');
        realtimeProcessor.startMockGenerator();
      }
    }

    if (process.env.MARKET_STREAM_ENABLED === 'false') {
      logger.info('[market-live] stream manager disabled via MARKET_STREAM_ENABLED=false — not connecting.');
      return;
    }

    this.started = true;
    this.startedAt = new Date().toISOString();

    const mints = resolveTrackedMints(env.MARKET_STREAM_TRACKED_MINTS);
    const programIds = resolveTrackedProgramIds(env.MARKET_STREAM_PROGRAM_IDS);

    logger.info('[market-live] starting stream manager', {
      mintCount: mints.length,
      programCount: Object.keys(programIds).length,
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


    // 2. Helius WebSocket stream (logsSubscribe) — the real ingestion path.
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
  }

  stop(): void {
    this.birdeye?.stop();
    this.helius?.stop();
    this.started = false;
  }

  getHealth(): StreamManagerHealth {
    return {
      birdeye: this.birdeye?.getHealth() ?? { state: 'closed', lastMessageAt: null, consecutiveFailures: 0 },
      helius: this.helius?.getHealth() ?? { state: 'closed', lastMessageAt: null, consecutiveFailures: 0 },
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
