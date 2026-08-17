export type PriceSource = 'POOL_PRICE' | 'DEX_AGGREGATED' | 'ORACLE' | 'MARK_PRICE' | 'MID_PRICE';

export interface PriceUpdate {
  token: string;
  chain: string;
  price: number;
  source: PriceSource;
  timestamp: number;
  liquidityUsd?: number;
}

export interface StreamHealth {
  source: PriceSource;
  lastUpdate: number;
  latencyMs: number;
  isHealthy: boolean;
}

/**
 * PriceStream aggregates market data and manages feed health.
 * Instead of every order querying the chain independently,
 * the PriceStream provides a central feed for the TriggerEngine.
 */
export class PriceStream {
  private health: Map<PriceSource, StreamHealth> = new Map();
  private subscribers: Set<(update: PriceUpdate) => void> = new Set();
  
  constructor() {
    // Initialize mock feeds
    ['POOL_PRICE', 'DEX_AGGREGATED', 'ORACLE'].forEach(src => {
      this.health.set(src as PriceSource, {
        source: src as PriceSource,
        lastUpdate: Date.now(),
        latencyMs: 0,
        isHealthy: true
      });
    });
  }

  public subscribe(callback: (update: PriceUpdate) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  public publish(update: PriceUpdate) {
    // 1. Check health/outliers
    const health = this.health.get(update.source);
    if (health) {
      health.latencyMs = Date.now() - update.timestamp;
      health.lastUpdate = Date.now();
      health.isHealthy = health.latencyMs < 5000; // Unhealthy if stale > 5s
      this.health.set(update.source, health);
    }

    if (!health?.isHealthy) {
      console.warn(`[PriceStream] Feed ${update.source} is unhealthy. Delaying triggers.`);
      return; // Skip publishing if feed is unhealthy (prevents false triggers)
    }

    // 2. Publish to TriggerEngine
    this.subscribers.forEach(cb => cb(update));
  }

  public getHealth(source: PriceSource): StreamHealth | undefined {
    return this.health.get(source);
  }
}

// Singleton for MVP
export const globalPriceStream = new PriceStream();
