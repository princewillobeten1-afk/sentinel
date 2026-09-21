import { env } from '../env';
import { logger } from '../logger';
import { eventBus } from '../events/event-bus';
import { EVENT_TYPES, type NormalizedRealtimeEvent } from '../events/event-types';
import { realtimeRepository } from '../db/realtime-repository';
import { acquireBirdeyeSlot } from '@/lib/market/enrichment/birdeye-limiter';

interface BirdeyeMarketResponse {
  price?: number;
  liquidity?: number;
  v24hUSD?: number;
  mc?: number;
  priceChange24hPercent?: number;
}

export class BirdeyeEnrichmentWorker {
  private static instance: BirdeyeEnrichmentWorker;
  private queue: string[] = [];
  private isProcessing = false;
  private retryMap = new Map<string, number>();

  private constructor() {}

  public static getInstance(): BirdeyeEnrichmentWorker {
    if (!BirdeyeEnrichmentWorker.instance) {
      BirdeyeEnrichmentWorker.instance = new BirdeyeEnrichmentWorker();
    }
    return BirdeyeEnrichmentWorker.instance;
  }

  /**
   * Enqueues a token mint for asynchronous Birdeye market data enrichment.
   */
  public enqueue(mint: string): void {
    if (!mint || this.queue.includes(mint)) return;
    this.queue.push(mint);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const mint = this.queue.shift();
      if (!mint) continue;

      try {
        await this.enrichToken(mint);
      } catch (err) {
        logger.warn('[birdeye-enrichment] failed to enrich token', { mint, error: (err as Error).message });
      }

      // Pacing is handled by the shared limiter inside `enrichToken`, not here.
      //
      // A local 250ms delay could not respect a per-account limit: this worker
      // is enqueued from `events/processor.ts` on every realtime event, so its
      // rate followed chain activity, and it starved the ownership audit
      // completely — 0 of 20 rows resolved in two minutes while a single manual
      // request to the same key returned 429.
    }

    this.isProcessing = false;
  }

  private async enrichToken(mint: string): Promise<void> {
    const apiKey = env.BIRDEYE_API_KEY;
    if (!apiKey) return;

    // Background priority: these values are a top-up, and Jupiter supplies the
    // same price/liquidity/volume. Audit lookups, which a reader is actively
    // waiting on behind a pending pip, are served first.
    await acquireBirdeyeSlot('background');

    const url = `https://public-api.birdeye.so/defi/v3/token/market-data?address=${encodeURIComponent(mint)}`;
    const response = await fetch(url, {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
    });

    if (response.status === 429) {
      // Rate limited: requeue with backoff
      const retries = (this.retryMap.get(mint) || 0) + 1;
      if (retries <= 3) {
        this.retryMap.set(mint, retries);
        setTimeout(() => this.enqueue(mint), retries * 2000);
      }
      return;
    }

    if (!response.ok) return;

    const json = await response.json();
    const data: BirdeyeMarketResponse = json.data || {};

    const updateEvent: NormalizedRealtimeEvent = {
      id: `enrich_${mint}_${Date.now()}`,
      sequence: 0, // Assigned upon publication
      type: EVENT_TYPES.TOKEN_UPDATE,
      timestamp: Date.now(),
      mint,
      price: data.price,
      priceUsd: data.price,
      liquidityUsd: data.liquidity,
      marketCapUsd: data.mc,
      volume24hUsd: data.v24hUSD,
      source: 'birdeye',
      commitment: 'confirmed',
    };

    // 1. Publish enriched TOKEN_UPDATE event to the real-time event bus
    await eventBus.publish(updateEvent);

    // 2. Persist update into PostgreSQL
    void realtimeRepository.saveTokenUpdate({
      mint,
      priceUsd: data.price,
      liquidityUsd: data.liquidity,
      marketCapUsd: data.mc,
      volume24hUsd: data.v24hUSD,
    });
  }
}

export const birdeyeEnrichment = BirdeyeEnrichmentWorker.getInstance();
