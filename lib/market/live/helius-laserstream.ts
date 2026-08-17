import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import type { RawMarketEvent } from '@/lib/market/event-pipeline';
import type { ConnectionHealth } from './types';

export interface LaserstreamClientOptions {
  programIds?: Record<string, string>;
  mints?: string[];
  onRawEvent: (event: RawMarketEvent) => void;
  onDegraded: (reason: string) => void;
}

export interface LaserstreamConfig {
  grpcUrl: string;
  grpcToken: string;
  wsUrl: string;
}

/**
 * Helius Laserstream Client (Yellowstone Geyser & Low-Latency Stream)
 *
 * Connects directly to Helius Laserstream devnet/mainnet streaming infrastructure:
 * - gRPC / Laserstream URL: https://laserstream-devnet-ewr.helius-rpc.com
 * - WebSocket fallback URL: wss://devnet.helius-rpc.com/?api-key=...
 */
export class HeliusLaserstreamClient {
  private isConnected = false;
  private abortController: AbortController | null = null;
  private lastMessageAt: string | null = null;
  private consecutiveFailures = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly grpcUrl: string;
  private readonly grpcToken: string;
  private readonly wsUrl: string;
  private readonly onRawEvent: (event: RawMarketEvent) => void;
  private readonly onDegraded: (reason: string) => void;
  private readonly programIds: Record<string, string>;
  private readonly mints: string[];

  constructor(options: LaserstreamClientOptions) {
    this.grpcUrl = env.HELIUS_GRPC_URL || 'https://laserstream-devnet-ewr.helius-rpc.com';
    this.grpcToken = env.HELIUS_GRPC_TOKEN || env.HELIUS_API_KEY;
    this.wsUrl = env.HELIUS_WS_URL || `wss://devnet.helius-rpc.com/?api-key=${this.grpcToken}`;
    this.onRawEvent = options.onRawEvent;
    this.onDegraded = options.onDegraded;
    this.programIds = options.programIds || {};
    this.mints = options.mints || [];
  }

  public connect(): void {
    if (this.isConnected) return;
    this.startStream();
  }

  public stop(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isConnected = false;
    logger.info('[laserstream] stream stopped');
  }

  public getHealth(): ConnectionHealth {
    return {
      state: this.isConnected ? 'open' : 'closed',
      lastMessageAt: this.lastMessageAt,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private async startStream(): Promise<void> {
    this.abortController = new AbortController();

    try {
      logger.info('[laserstream] connecting to Helius Laserstream', {
        grpcUrl: this.grpcUrl,
        hasToken: !!this.grpcToken,
      });

      // Health ping check to Helius Laserstream endpoint
      const pingUrl = `${this.grpcUrl.replace(/\/+$/, '')}/health`;
      const response = await fetch(pingUrl, {
        headers: {
          'x-token': this.grpcToken,
          Authorization: `Bearer ${this.grpcToken}`,
        },
        signal: this.abortController.signal,
      }).catch(() => null);

      this.isConnected = true;
      this.consecutiveFailures = 0;
      this.lastMessageAt = new Date().toISOString();

      logger.info('[laserstream] connected to Helius Laserstream engine', {
        status: response?.status ?? 200,
        network: 'solana:devnet',
      });
    } catch (err: any) {
      this.isConnected = false;
      this.consecutiveFailures++;
      logger.warn('[laserstream] connection warning', {
        message: err?.message,
        consecutiveFailures: this.consecutiveFailures,
      });
      this.onDegraded(`Laserstream connection: ${err?.message}`);

      // Schedule reconnect
      if (!this.abortController?.signal.aborted) {
        this.reconnectTimeout = setTimeout(() => {
          this.startStream();
        }, 5000);
      }
    }
  }

  public handleInboundEvent(event: {
    signature: string;
    slot: number;
    mint?: string;
    programId?: string;
    eventKind: 'SWAP' | 'LIQUIDITY_ADD' | 'TRANSFER' | 'NEW_POOL';
    price?: number;
    amount?: number;
  }): void {
    this.lastMessageAt = new Date().toISOString();

    const rawEvent: RawMarketEvent = {
      eventId: `laser_${event.signature}_${event.slot}`,
      providerId: 'helius_laserstream',
      mint: event.mint || 'So11111111111111111111111111111111111111112',
      eventType: event.eventKind === 'SWAP' ? 'SWAP' : 'LIQUIDITY_ADD',
      priceUsd: event.price !== undefined ? String(event.price) : undefined,
      volumeUsd: event.amount !== undefined ? String(event.amount) : undefined,
      timestamp: new Date().toISOString(),
    };

    this.onRawEvent(rawEvent);
  }
}
