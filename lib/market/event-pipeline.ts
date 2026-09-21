import { recordAuditEvent } from '@/lib/server/audit';
import { logger } from '@/lib/server/logger';

export interface RawMarketEvent {
  eventId: string;
  providerId: string;
  mint: string;
  eventType: 'SWAP' | 'LIQUIDITY_ADD' | 'LIQUIDITY_REMOVE' | 'PRICE_UPDATE';
  priceUsd?: string;
  volumeUsd?: string;
  /**
   * Direction of a SWAP, when the source actually measured it.
   *
   * Without this every swap was persisted as a BUY, because the stream manager
   * mapped `eventType === 'SWAP'` straight to `BUY`. On a platform whose whole
   * premise is separating genuine flow from wash trading, recording every sell
   * as a buy corrupts the measurement it exists to make. Left undefined when
   * the source cannot tell, and the consumer then keeps its own default rather
   * than being handed a guess.
   */
  side?: 'BUY' | 'SELL';
  /**
   * The bare on-chain transaction signature.
   *
   * Distinct from `eventId`, which is namespaced as
   * `helius_<signature>_<programLabel>` to keep provider events unique. That
   * namespaced value was being persisted into `realtime_trades.signature`,
   * producing rows whose "signature" could not be looked up on any explorer.
   * Carrying the real one separately also means dedup keys on the transaction
   * itself, so a swap matched under two program subscriptions collapses to a
   * single event instead of two.
   */
  signature?: string;
  /**
   * The trading wallet, when the provider identified one.
   *
   * Without this `realtime_trades.wallet` was null on all 22,253 real captures,
   * so any per-wallet view grouped by a column that never had a value.
   */
  wallet?: string;
  tokenAmount?: number;
  amountSol?: number;
  timestamp: string;
}

export interface NormalizedMarketEvent {
  id: string;
  mint: string;
  eventType: string;
  priceUsd?: string;
  volumeUsd?: string;
  provider: string;
  freshness: 'fresh' | 'stale';
  processedAt: string;
}

export class MarketEventPipeline {
  private static instance: MarketEventPipeline;
  private processedEventIds: Set<string> = new Set();
  // These two labels are what NormalizedMarketEvent.provider is actually set
  // from below (processEvent() never reads raw.providerId) — keep them in
  // sync with the real upstream providers wired in lib/market/live/.
  private activeProvider = 'birdeye_ws';
  private secondaryProvider = 'helius_logs_ws';
  private providerHealth: Map<string, boolean> = new Map([
    ['birdeye_ws', true],
    ['helius_logs_ws', true],
  ]);

  private constructor() {}

  public static getInstance(): MarketEventPipeline {
    if (!MarketEventPipeline.instance) {
      MarketEventPipeline.instance = new MarketEventPipeline();
    }
    return MarketEventPipeline.instance;
  }

  /**
   * Process raw market event through listener, normalizer, quality validator, and failover check.
   */
  public processEvent(raw: RawMarketEvent): NormalizedMarketEvent | null {
    // 1. Deduplication Check
    if (this.processedEventIds.has(raw.eventId)) {
      logger.warn(`[PIPELINE] Duplicate event dropped: ${raw.eventId}`);
      return null;
    }

    // 2. Data Quality & Out-of-Order Check
    const eventTime = new Date(raw.timestamp).getTime();
    if (isNaN(eventTime) || eventTime < Date.now() - 300000) { // Older than 5 minutes
      logger.warn(`[PIPELINE] Out-of-order or stale event dropped: ${raw.eventId}`);
      return null;
    }

    // 3. Provider Health & Failover Check
    let isStale = false;
    let providerName = this.activeProvider;

    if (!this.providerHealth.get(this.activeProvider)) {
      this.triggerFailover('RPC Timeout detected on primary provider');
      providerName = this.secondaryProvider;
      isStale = true;
    }

    this.processedEventIds.add(raw.eventId);
    if (this.processedEventIds.size > 2000) {
      // Memory cleanup for set
      const items = Array.from(this.processedEventIds);
      this.processedEventIds = new Set(items.slice(1000));
    }

    const normalized: NormalizedMarketEvent = {
      id: `norm_${raw.eventId}`,
      mint: raw.mint,
      eventType: raw.eventType,
      ...(raw.priceUsd !== undefined ? { priceUsd: raw.priceUsd } : {}),
      ...(raw.volumeUsd !== undefined ? { volumeUsd: raw.volumeUsd } : {}),
      provider: providerName,
      freshness: isStale ? 'stale' : 'fresh',
      processedAt: new Date().toISOString(),
    };

    logger.info(`[PIPELINE] Normalized event ${normalized.id} for ${normalized.mint}`);
    return normalized;
  }

  /**
   * Triggers provider failover if RPC errors occur.
   */
  public triggerFailover(reason: string): void {
    logger.warn(`[FAILOVER] Primary market provider failure: ${reason}`);
    this.providerHealth.set(this.activeProvider, false);

    recordAuditEvent({
      action: 'AUTH_FAILED', // Incident record
      entityType: 'user',
      changes: { incident: 'MARKET_PROVIDER_FAILOVER', reason, failedProvider: this.activeProvider, fallbackProvider: this.secondaryProvider },
    });
  }

  public resetProviderHealth(): void {
    this.providerHealth.set(this.activeProvider, true);
  }
}

export const marketEventPipeline = MarketEventPipeline.getInstance();
