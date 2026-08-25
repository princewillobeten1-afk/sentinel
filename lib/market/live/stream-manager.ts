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
import { getEnricherStats, type EnricherStats } from './transaction-enricher';
import type { ConnectionHealth } from './types';

export interface StreamManagerHealth {
  birdeye: ConnectionHealth;
  helius: ConnectionHealth;
  trackedMintCount: number;
  trackedProgramCount: number;
  recentEventCount: number;
  startedAt: string | null;
  /**
   * Mint the stream is currently focused on, or null when sweeping.
   *
   * Reported so it is never ambiguous which mode is running — a paused
   * market-wide capture should be visible, not inferred from a quiet feed.
   */
  focusedMint: string | null;
  /**
   * Parsed-transaction enrichment counters.
   *
   * Exposed rather than kept internal because the enricher deliberately drops
   * work under load: a feed that quietly samples a fraction of trades while
   * presenting itself as complete is worse than one that says what it missed.
   * `droppedQueueFull` is the number never fetched; `droppedNoMint` is fetched
   * but skipped because no subject token could be derived.
   */
  enricher: EnricherStats;
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

  /**
   * Aim the enrichment budget at one token, for as long as its page is open.
   *
   * The call budget cannot cover both a full DEX sweep and one token's tape,
   * so focusing swaps the broad subscriptions for a single `mentions:[mint]`
   * one. The trade-off is explicit and reported by `getHealth()`: while
   * focused, market-wide capture is paused.
   */
  focusMint(mint: string): void {
    this.helius?.focusMint(mint);
  }

  clearFocus(): void {
    this.helius?.clearFocus();
  }

  getHealth(): StreamManagerHealth {
    return {
      birdeye: this.birdeye?.getHealth() ?? { state: 'closed', lastMessageAt: null, consecutiveFailures: 0 },
      helius: this.helius?.getHealth() ?? { state: 'closed', lastMessageAt: null, consecutiveFailures: 0 },
      trackedMintCount: resolveTrackedMints(env.MARKET_STREAM_TRACKED_MINTS).length,
      trackedProgramCount: Object.keys(resolveTrackedProgramIds(env.MARKET_STREAM_PROGRAM_IDS)).length,
      recentEventCount: liveMarketCache.getRecentEvents(Number.MAX_SAFE_INTEGER).length,
      startedAt: this.startedAt,
      focusedMint: this.helius?.getFocusedMint() ?? null,
      enricher: getEnricherStats(),
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
      // A swap carries its measured direction when the enricher could read it
      // off the token-balance deltas; only fall back to BUY when it could not.
      // Mapping every swap to BUY unconditionally is why `realtime_trades`
      // held no sells at all.
      type: (raw.eventType === 'SWAP'
        ? raw.side === 'SELL'
          ? 'SELL'
          : 'BUY'
        : raw.eventType === 'LIQUIDITY_ADD'
          ? 'LIQUIDITY_ADDED'
          : 'TOKEN_UPDATE') as any,
      // The bare on-chain signature when the provider supplied one. Passing
      // `eventId` here is what wrote `helius_<sig>_<program>` into
      // `realtime_trades.signature`, a value no explorer can resolve.
      signature: raw.signature || raw.eventId || `evt_${Date.now()}`,
      slot: 0,
      programId: raw.providerId,
      mint: raw.mint,
      // Persisted by realtimeRepository.saveTrade, which already accepts it.
      wallet: raw.wallet,
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
