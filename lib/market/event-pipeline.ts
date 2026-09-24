import { recordAuditEvent } from '@/lib/server/audit';
import { logger } from '@/lib/server/logger';
import { chainEventId } from './event-identity';

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
  /** Only set when the provider or transaction decoder actually identifies it. */
  instructionIndex?: number;
  innerInstructionIndex?: number;
  slot?: number;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Chain time only; never substitute provider receipt time for this field. */
  chainTimestamp?: number;
  programId?: string;
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

/** Cross-provider identity for on-chain facts; market ticks retain their source ID. */
export function marketEventId(raw: RawMarketEvent): string {
  const kind = raw.eventType === 'SWAP' ? (raw.side ?? 'SWAP_UNRESOLVED') : raw.eventType;
  return raw.signature && raw.eventType !== 'PRICE_UPDATE'
    ? chainEventId({ signature: raw.signature, mint: raw.mint, kind,
      instructionIndex: raw.instructionIndex, innerInstructionIndex: raw.innerInstructionIndex }) ?? raw.eventId
    : raw.eventId;
}

export class MarketEventPipeline {
  private static instance: MarketEventPipeline;
  private processedEventIds: Set<string> = new Set();
  // Health is tracked by source; normalized provenance comes from raw.providerId.
  private providerHealth: Map<string, boolean> = new Map([
    ['birdeye_ws', true],
    ['helius_logs_ws', true],
    ['quicknode_logs_ws', true],
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
    const identity = marketEventId(raw);
    // 1. Deduplication Check
    if (this.processedEventIds.has(identity)) {
      logger.warn(`[PIPELINE] Duplicate event dropped: ${identity}`);
      return null;
    }

    // 2. Data Quality & Out-of-Order Check
    const eventTime = new Date(raw.timestamp).getTime();
    if (isNaN(eventTime) || eventTime < Date.now() - 300000) { // Older than 5 minutes
      logger.warn(`[PIPELINE] Out-of-order or stale event dropped: ${raw.eventId}`);
      return null;
    }

    // 3. Provider Health & Failover Check
    const providerName = raw.providerId.startsWith('quicknode_logs_') ? 'quicknode_logs_ws'
      : raw.providerId.startsWith('helius_logs_') ? 'helius_logs_ws'
        : raw.providerId.startsWith('birdeye_') ? 'birdeye_ws' : raw.providerId;
    // A current event proves this particular source has recovered.
    this.providerHealth.set(providerName, true);

    this.processedEventIds.add(identity);
    if (this.processedEventIds.size > 2000) {
      // Memory cleanup for set
      const items = Array.from(this.processedEventIds);
      this.processedEventIds = new Set(items.slice(1000));
    }

    const normalized: NormalizedMarketEvent = {
      id: identity,
      mint: raw.mint,
      eventType: raw.eventType,
      ...(raw.priceUsd !== undefined ? { priceUsd: raw.priceUsd } : {}),
      ...(raw.volumeUsd !== undefined ? { volumeUsd: raw.volumeUsd } : {}),
      provider: providerName,
      freshness: 'fresh',
      processedAt: new Date().toISOString(),
    };

    logger.info(`[PIPELINE] Normalized event ${normalized.id} for ${normalized.mint}`);
    return normalized;
  }

  /**
   * Triggers provider failover if RPC errors occur.
   */
  public triggerFailover(reason: string, provider = 'birdeye_ws'): void {
    logger.warn(`[FAILOVER] Market provider degraded: ${reason}`, { provider });
    this.providerHealth.set(provider, false);

    recordAuditEvent({
      action: 'AUTH_FAILED', // Incident record
      entityType: 'user',
      changes: { incident: 'MARKET_PROVIDER_FAILOVER', reason, failedProvider: provider },
    });
  }

  public resetProviderHealth(): void {
    for (const provider of this.providerHealth.keys()) this.providerHealth.set(provider, true);
  }
}

export const marketEventPipeline = MarketEventPipeline.getInstance();
