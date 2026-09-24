import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import { marketEventId, marketEventPipeline, type RawMarketEvent } from '@/lib/market/event-pipeline';
import { signalProcessor } from '@/lib/discovery/signal-processor';
import { BirdeyeClient } from './birdeye-client';
import { HeliusClient } from './helius-client';
import { liveMarketCache } from './live-cache';
import { resolveTrackedMints } from './subscription-set';
import { realtimeProcessor } from '@/lib/server/events/processor';
import { getEnricherStats, type EnricherStats } from './transaction-enricher';
import { getLiveClientCount, getWatchedMints, onWatchedMintsChange } from './stream-demand';
import type { ConnectionHealth } from './types';
import { auditStats, setAuditTargets } from '@/lib/market/enrichment/audit-worker';
import { securityStats, setSecurityTargets } from '@/lib/market/enrichment/security-worker';
import { hydrateTokenCards, startTokenCardFanout, tokenCardCacheStats } from './card-cache';
import { dexMarketStats, queueDexMarketReconciliation } from '@/lib/discovery/dexscreener-market';
import { birdeyeLimiterStats } from '@/lib/market/enrichment/birdeye-limiter';
import { tokenCardPersistenceHealth } from '@/lib/server/db/token-card-evidence-repository';
import { getChartDemand, onChartDemand } from './chart-stream';
import { ChartPoller } from './chart-poller';
import { quickNodeService } from '@/lib/server/quicknode';
import { redis } from '@/lib/server/redis';
import { capabilityHealth } from './capability-health';
import { realtimeRepository } from '@/lib/server/db/realtime-repository';

/**
 * How long watched-mint changes are gathered before Helius is told.
 *
 * Clients reconcile their topics in bursts — a Discover refresh unsubscribes
 * the rows that left and subscribes the ones that arrived, across several
 * messages. Batching those into one reconcile keeps a churning column from
 * becoming a churn of upstream subscribes.
 */
const DEMAND_DEBOUNCE_MS = 750;

export interface StreamManagerHealth {
  birdeye: ConnectionHealth;
  helius: ConnectionHealth;
  chainLogProvider: 'helius' | 'quicknode' | null;
  quickNode: ReturnType<typeof quickNodeService.getHealth>;
  trackedMintCount: number;
  recentEventCount: number;
  startedAt: string | null;
  /**
   * Mint a token page has asked the stream to guarantee, or null.
   */
  focusedMint: string | null;
  /** Connected live-stream clients. */
  liveClientCount: number;
  /** Mints connected clients are watching — what the Helius stream subscribes to. */
  watchedMintCount: number;
  /** Per-mint Helius subscriptions actually held, after the subscription cap. */
  subscribedMintCount: number;
  /** Whether the pump.fun migration watch is live. */
  migrationWatch: boolean;
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
  cardCache: ReturnType<typeof tokenCardCacheStats>;
  security: ReturnType<typeof securityStats>;
  dexScreener: ReturnType<typeof dexMarketStats>;
  ownershipAudit: ReturnType<typeof auditStats>;
  birdeyeRestLimiter: ReturnType<typeof birdeyeLimiterStats>;
  evidencePersistence: ReturnType<typeof tokenCardPersistenceHealth>;
  chartPolling: ReturnType<ChartPoller['getHealth']>;
  capabilities: ReturnType<typeof capabilityHealth>;
}

/**
 * Orchestrates the Birdeye and Helius WebSocket clients, wiring both into the
 * existing `MarketEventPipeline` → live cache → `SignalProcessor`, and onward
 * to the realtime fast path, which persists trades to `realtime_trades`.
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
  private unsubscribeChartDemand: (() => void) | null = null;
  private chartPoller = new ChartPoller();
  private helius: HeliusClient | null = null;
  private started = false;
  private startedAt: string | null = null;
  private demandTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeDemand: (() => void) | null = null;

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
    startTokenCardFanout();

    const mints = resolveTrackedMints(env.MARKET_STREAM_TRACKED_MINTS);
    logger.info('[market-live] starting stream manager', { mintCount: mints.length });

    // 1. Birdeye Stream
    try {
      this.birdeye = new BirdeyeClient({
        mints,
        onRawEvent: (event) => { void this.handleRawEvent(event); },
        onDegraded: (reason) => marketEventPipeline.triggerFailover(`Birdeye: ${reason}`, 'birdeye_ws'),
      });
      this.birdeye.connect();
    } catch (err) {
      logger.error('[market-live] failed to start Birdeye client', {
        message: err instanceof Error ? err.message : String(err),
      });
    }


    // 2. Helius WebSocket stream (logsSubscribe) — the real ingestion path,
    //    scoped to the migration authority plus whatever clients are watching.
    try {
      this.helius = new HeliusClient({
        onRawEvent: (event) => { void this.handleRawEvent(event); },
        onDegraded: (reason) => {
          const provider = this.helius?.getTransport() === 'quicknode' ? 'quicknode_logs_ws' : 'helius_logs_ws';
          marketEventPipeline.triggerFailover(`Chain logs: ${reason}`, provider);
        },
      });
      this.helius.connect();
    } catch (err) {
      logger.error('[market-live] failed to start Helius WS client', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    this.trackDemand();
    this.chartPoller.start();
  }

  /**
   * Keeps the Helius subscriptions matched to what clients are watching.
   *
   * The stream used to sweep three whole DEX programs from boot, forever,
   * whether or not anyone was connected — 36.7 MB/min, nearly all discarded.
   * It now subscribes to the mints in `stream-demand`'s ledger and nothing
   * else (plus the migration watch, which the client holds on its own). With
   * no clients that ledger is empty, so an idle server pays ~0.01 MB/min.
   */
  private trackDemand(): void {
    const apply = () => {
      this.demandTimer = null;
      const visibleMints = getWatchedMints();
      void hydrateTokenCards(visibleMints);
      this.helius?.setWatchedMints(visibleMints);
      this.birdeye?.setMints(visibleMints, getChartDemand());
      this.chartPoller.setTargets(getChartDemand());
      // The same set the browser has explicitly subscribed to drives the
      // expensive ownership queue. No separate firehose or guessed "popular"
      // list can steal its quota from what the user is looking at.
      setAuditTargets('visible', visibleMints);
      setSecurityTargets(visibleMints);
    };

    this.unsubscribeDemand?.();
    const scheduleDemand = () => {
      if (this.demandTimer) return;
      this.demandTimer = setTimeout(apply, DEMAND_DEBOUNCE_MS);
      this.demandTimer.unref?.();
    };
    this.unsubscribeDemand = onWatchedMintsChange(scheduleDemand);
    this.unsubscribeChartDemand?.();
    this.unsubscribeChartDemand = onChartDemand(scheduleDemand);
    apply();
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    // Refresh eligibility changes with time even when visibility does not.
    // Workers enforce their own TTLs and quota pauses; do not resubscribe the
    // upstream sockets every time we check for due enrichment.
    this.refreshTimer = setInterval(() => {
      const visibleMints = getWatchedMints();
      setAuditTargets('visible', visibleMints);
      setSecurityTargets(visibleMints);
      queueDexMarketReconciliation(visibleMints);
    }, 15_000);
    this.refreshTimer.unref?.();
  }

  stop(): void {
    this.chartPoller.stop();
    this.unsubscribeChartDemand?.();
    this.unsubscribeChartDemand = null;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    this.unsubscribeDemand?.();
    this.unsubscribeDemand = null;
    if (this.demandTimer) {
      clearTimeout(this.demandTimer);
      this.demandTimer = null;
    }
    this.birdeye?.stop();
    this.helius?.stop();
    this.started = false;
  }

  /**
   * Aim the enrichment budget at one token, for as long as its page is open.
   *
   * Every subscription is already scoped to a mint, so focusing no longer
   * pauses anything: it guarantees the page's token a subscription even
   * before a socket holds a topic for it.
   */
  focusMint(mint: string): void {
    this.helius?.focusMint(mint);
  }

  clearFocus(): void {
    this.helius?.clearFocus();
  }

  getHealth(): StreamManagerHealth {
    const birdeye = this.birdeye?.getHealth() ?? { state: 'closed' as const, lastMessageAt: null, consecutiveFailures: 0 };
    const helius = this.helius?.getHealth() ?? { state: 'closed' as const, lastMessageAt: null, consecutiveFailures: 0 };
    const chainLogProvider = this.helius?.getTransport() ?? null;
    const quickNode = quickNodeService.getHealth();
    const chartPolling = this.chartPoller.getHealth();
    return {
      birdeye,
      helius,
      chainLogProvider,
      quickNode,
      trackedMintCount: resolveTrackedMints(env.MARKET_STREAM_TRACKED_MINTS).length,
      recentEventCount: liveMarketCache.getRecentEvents(Number.MAX_SAFE_INTEGER).length,
      startedAt: this.startedAt,
      focusedMint: this.helius?.getFocusedMint() ?? null,
      liveClientCount: getLiveClientCount(),
      watchedMintCount: getWatchedMints().length,
      subscribedMintCount: this.helius?.getSubscriptionCounts().mints ?? 0,
      migrationWatch: this.helius?.getSubscriptionCounts().migrations ?? false,
      enricher: getEnricherStats(),
      cardCache: tokenCardCacheStats(),
      security: securityStats(),
      dexScreener: dexMarketStats(),
      ownershipAudit: auditStats(),
      birdeyeRestLimiter: birdeyeLimiterStats(),
      evidencePersistence: tokenCardPersistenceHealth(),
      chartPolling,
      capabilities: capabilityHealth({ birdeye, chainLogs: helius, chainLogProvider,
        quickNode, chartPolling, birdeyeConfigured: Boolean(env.BIRDEYE_API_KEY) }),
    };
  }

  private async handleRawEvent(raw: RawMarketEvent): Promise<void> {
    const normalized = marketEventPipeline.processEvent(raw);
    if (!normalized) {
      this.enrichExistingTrade(raw);
      return;
    }

    // The pipeline's hot-path set is process-local. Claim the provider-neutral
    // identity before any cache, signal or client receives this observation.
    if (!await redis.claim(`market-event:${normalized.id}`, raw.signature ? 3_600 : 60)) {
      this.enrichExistingTrade(raw);
      return;
    }

    liveMarketCache.update(normalized);
    signalProcessor.ingestEvent(normalized);
    // The `market_events` write used to sit here. It was removed rather than
    // repaired: it wrote through a mock client whose `query` always resolved
    // `{rows: []}`, into a `market_events` table that exists in `db/schema.sql`
    // but in no migration — so the table was never created — and **nothing in
    // the codebase reads it**. Every row it would have written carried
    // `token_id: NULL`, at the full event rate, with no join key.
    //
    // Trades persist durably through `realtime-repository.saveTrade` into
    // `realtime_trades`, which is the path the app actually queries.

    // Forward to Real-Time Event Pipeline (Fast Path + Async Path)
    // A provider tick without a chain signature is not a blockchain event.
    // It already reached the market cache above; do not persist an invented tx.
    if (!raw.signature || raw.eventType === 'PRICE_UPDATE') return;
    const source = raw.providerId.startsWith('quicknode_logs_') ? 'quicknode'
      : raw.providerId.startsWith('helius_logs_') ? 'helius_ws' : 'birdeye';
    void realtimeProcessor.processDecodedEvent({
      // A directionless provider swap is a market update, not a buy. Only the
      // Helius balance-delta decoder is allowed to publish BUY/SELL.
      type: (raw.eventType === 'SWAP'
        ? raw.side === 'SELL'
          ? 'SELL'
          : raw.side === 'BUY'
            ? 'BUY'
            : 'TOKEN_UPDATE'
        : raw.eventType === 'LIQUIDITY_ADD'
          ? 'LIQUIDITY_ADDED'
          : 'TOKEN_UPDATE') as any,
      signature: raw.signature,
      slot: raw.slot,
      programId: raw.programId,
      instructionIndex: raw.instructionIndex,
      innerInstructionIndex: raw.innerInstructionIndex,
      mint: raw.mint,
      // Persisted by realtimeRepository.saveTrade, which already accepts it.
      wallet: raw.wallet,
      amount: raw.tokenAmount,
      amountSol: raw.amountSol,
      amountUsd: raw.volumeUsd ? Number(raw.volumeUsd) : undefined,
      price: raw.priceUsd ? Number(raw.priceUsd) : undefined,
      chainTimestamp: raw.chainTimestamp,
    }, source, Date.now(), raw.commitment);

    logger.debug('[market-live] event normalized', {
      mint: normalized.mint,
      eventType: normalized.eventType,
      provider: normalized.provider,
    });
  }

  /** A second provider may fill missing fields without broadcasting a second trade. */
  private enrichExistingTrade(raw: RawMarketEvent): void {
    if (raw.eventType !== 'SWAP' || !raw.signature || !raw.side) return;
    const observedAt = Date.parse(raw.timestamp);
    if (!Number.isFinite(observedAt) || observedAt < Date.now() - 300_000) return;
    const measuredNumber = (value: string | number | undefined) => {
      if (value === undefined) return undefined;
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    };
    void realtimeRepository.saveTrade({
      eventId: marketEventId(raw), signature: raw.signature, mint: raw.mint,
      side: raw.side, instructionIndex: raw.instructionIndex,
      innerInstructionIndex: raw.innerInstructionIndex, wallet: raw.wallet,
      amount: raw.tokenAmount, amountSol: raw.amountSol,
      priceUsd: measuredNumber(raw.priceUsd), slot: raw.slot,
      timestamp: raw.timestamp, source: raw.providerId,
      commitment: raw.commitment,
    });
  }
}

const globalForStream = globalThis as unknown as { marketStreamManager?: StreamManager };
export const marketStreamManager = globalForStream.marketStreamManager ?? new StreamManager();
if (process.env.NODE_ENV !== 'production') globalForStream.marketStreamManager = marketStreamManager;
