import { logger } from '@/lib/server/logger';
import type { DiscoveryToken } from './types';
import type { NormalizedMarketEvent } from '@/lib/market/event-pipeline';
import { detectAnomalies } from './anomaly-detector';

/**
 * Discovery Signal Types produced by the signal processor.
 */
export type DiscoverySignalType =
  | 'MOMENTUM_ACCELERATION'
  | 'VOLUME_SURGE'
  | 'LIQUIDITY_CHANGE'
  | 'BUY_PRESSURE'
  | 'HOLDER_GROWTH'
  | 'PRICE_VELOCITY'
  | 'ANOMALY_DETECTED'
  | 'NEW_TOKEN'
  | 'RANKING_CHANGE';

export interface DiscoverySignal {
  id: string;
  tokenId: string;
  tokenSymbol: string;
  signalType: DiscoverySignalType;
  score: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  metadata: Record<string, string | number>;
  createdAt: string;
}

type SignalListener = (signal: DiscoverySignal) => void;

/**
 * Event-Driven Signal Processor (Section 35)
 *
 * Pipeline:
 *   Market Event (from event-pipeline.ts)
 *         ↓
 *   Signal Processor (incremental update)
 *         ↓
 *   Discovery Signal (momentum, volume surge, anomaly, etc.)
 *         ↓
 *   Score Engine (updateTokenScore — not full recalculation)
 *         ↓
 *   Ranking Cache (update affected token's rank only)
 *         ↓
 *   Realtime Feed (broadcast to subscribers)
 *
 * Key design:
 *   - Incremental: Only the affected token is recalculated.
 *   - Batched: Events within a 500ms window are batched before processing.
 *   - Pub/Sub: Typed listeners receive emitted signals.
 */
export class SignalProcessor {
  private static instance: SignalProcessor;
  private listeners: Map<DiscoverySignalType | '*', SignalListener[]> = new Map();
  private eventBatch: NormalizedMarketEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_WINDOW_MS = 500;
  private signalCounter = 0;

  private constructor() {}

  public static getInstance(): SignalProcessor {
    if (!SignalProcessor.instance) {
      SignalProcessor.instance = new SignalProcessor();
    }
    return SignalProcessor.instance;
  }

  /**
   * Ingest a normalized market event. Batched for 500ms before processing.
   */
  public ingestEvent(event: NormalizedMarketEvent): void {
    this.eventBatch.push(event);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
        this.batchTimer = null;
      }, this.BATCH_WINDOW_MS);
    }
  }

  /**
   * Process batched events. Only affected tokens are recalculated.
   */
  private processBatch(): void {
    const batch = [...this.eventBatch];
    this.eventBatch = [];

    // Group events by token mint for incremental processing
    const byToken = new Map<string, NormalizedMarketEvent[]>();
    for (const event of batch) {
      const existing = byToken.get(event.mint) || [];
      existing.push(event);
      byToken.set(event.mint, existing);
    }

    logger.info(`[SIGNAL_PROCESSOR] Processing batch: ${batch.length} events across ${byToken.size} tokens`);

    // Process each affected token incrementally
    for (const [mint, events] of byToken) {
      this.processTokenEvents(mint, events);
    }
  }

  /**
   * Process events for a single token — incremental, not full universe recalculation.
   */
  private processTokenEvents(mint: string, events: NormalizedMarketEvent[]): void {
    const swapEvents = events.filter((e) => e.eventType === 'SWAP');
    const liquidityEvents = events.filter(
      (e) => e.eventType === 'LIQUIDITY_ADD' || e.eventType === 'LIQUIDITY_REMOVE'
    );
    const priceEvents = events.filter((e) => e.eventType === 'PRICE_UPDATE');

    // Emit volume signal if swap volume is significant
    if (swapEvents.length > 0) {
      const totalVolume = swapEvents.reduce((sum, e) => sum + parseFloat(e.volumeUsd || '0'), 0);
      if (totalVolume > 0) {
        this.emitSignal({
          tokenId: mint,
          tokenSymbol: mint.slice(0, 4).toUpperCase(),
          signalType: 'VOLUME_SURGE',
          score: Math.min(100, Math.round(Math.log10(Math.max(1, totalVolume)) * 15)),
          confidence: 0.85,
          metadata: {
            swapCount: swapEvents.length,
            totalVolumeUsd: totalVolume.toFixed(2),
            batchWindowMs: this.BATCH_WINDOW_MS,
          },
        });
      }
    }

    // Emit liquidity change signal
    if (liquidityEvents.length > 0) {
      const adds = liquidityEvents.filter((e) => e.eventType === 'LIQUIDITY_ADD').length;
      const removes = liquidityEvents.filter((e) => e.eventType === 'LIQUIDITY_REMOVE').length;
      this.emitSignal({
        tokenId: mint,
        tokenSymbol: mint.slice(0, 4).toUpperCase(),
        signalType: 'LIQUIDITY_CHANGE',
        score: Math.min(100, (adds + removes) * 25),
        confidence: 0.90,
        metadata: { additions: adds, removals: removes },
      });
    }

    // Emit price velocity signal
    if (priceEvents.length > 0) {
      const latestPrice = parseFloat(priceEvents[priceEvents.length - 1].priceUsd || '0');
      const earliestPrice = parseFloat(priceEvents[0].priceUsd || '0');
      const changePct = earliestPrice > 0
        ? ((latestPrice - earliestPrice) / earliestPrice) * 100
        : 0;

      if (Math.abs(changePct) > 1) {
        this.emitSignal({
          tokenId: mint,
          tokenSymbol: mint.slice(0, 4).toUpperCase(),
          signalType: 'PRICE_VELOCITY',
          score: Math.min(100, Math.round(Math.abs(changePct) * 5)),
          confidence: 0.82,
          metadata: {
            priceChangePct: changePct.toFixed(2),
            priceLatest: latestPrice.toFixed(8),
          },
        });
      }
    }
  }

  /**
   * Emit a signal and notify all registered listeners.
   */
  private emitSignal(partial: Omit<DiscoverySignal, 'id' | 'createdAt'>): void {
    const signal: DiscoverySignal = {
      ...partial,
      id: `sig_${++this.signalCounter}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    logger.info(`[SIGNAL] ${signal.signalType} for ${signal.tokenId} (score: ${signal.score})`);

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(signal.signalType) || [];
    for (const listener of typeListeners) {
      try { listener(signal); } catch (err) {
        logger.error(`[SIGNAL] Listener error for ${signal.signalType}`, { error: String(err) });
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*') || [];
    for (const listener of wildcardListeners) {
      try { listener(signal); } catch (err) {
        logger.error(`[SIGNAL] Wildcard listener error`, { error: String(err) });
      }
    }
  }

  /**
   * Subscribe to discovery signals.
   * Pass '*' to listen to all signal types.
   */
  public on(type: DiscoverySignalType | '*', listener: SignalListener): () => void {
    const existing = this.listeners.get(type) || [];
    existing.push(listener);
    this.listeners.set(type, existing);

    // Return unsubscribe function
    return () => {
      const current = this.listeners.get(type) || [];
      this.listeners.set(type, current.filter((l) => l !== listener));
    };
  }

  /**
   * Get current batch size (for observability).
   */
  public getPendingBatchSize(): number {
    return this.eventBatch.length;
  }

  /**
   * Get total signals emitted (for observability).
   */
  public getSignalCount(): number {
    return this.signalCounter;
  }
}

export const signalProcessor = SignalProcessor.getInstance();
