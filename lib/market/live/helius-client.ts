import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import type { RawMarketEvent } from '@/lib/market/event-pipeline';
import { ReconnectingWebSocketClient } from './ws-client';
import { matchLogsForProgram } from './helius-log-matchers';
import { normalizeHeliusLogMatch } from './normalizers';
import type { ConnectionHealth, HeliusLogsNotification, HeliusMessage, HeliusSubscribeResponse } from './types';

function isSubscribeResponse(message: HeliusMessage): message is HeliusSubscribeResponse {
  return typeof (message as HeliusSubscribeResponse).id === 'number' && typeof (message as HeliusSubscribeResponse).result === 'number';
}

function isLogsNotification(message: HeliusMessage): message is HeliusLogsNotification {
  return (message as HeliusLogsNotification).method === 'logsNotification';
}

export interface HeliusClientOptions {
  /** label → program ID, e.g. { raydium_amm_v4: '675k...' } */
  programIds: Record<string, string>;
  onRawEvent: (event: RawMarketEvent) => void;
  onDegraded: (reason: string) => void;
}

export class HeliusClient {
  private readonly client: ReconnectingWebSocketClient;
  private readonly programIds: Record<string, string>;
  private readonly onRawEvent: (event: RawMarketEvent) => void;

  /** Request id → program label, cleared and rebuilt on every (re)connect. */
  private pendingRequests = new Map<number, string>();
  /** Subscription id (from the RPC response) → program label. */
  private subscriptions = new Map<number, string>();
  private nextRequestId = 1;

  constructor(options: HeliusClientOptions) {
    this.programIds = options.programIds;
    this.onRawEvent = options.onRawEvent;

    const apiKey = env.getRequiredEnv('HELIUS_API_KEY');
    const wsUrl = env.HELIUS_WS_URL.includes('api-key=')
      ? env.HELIUS_WS_URL
      : `${env.HELIUS_WS_URL.replace(/\/+$/, '')}/?api-key=${apiKey}`;

    this.client = new ReconnectingWebSocketClient({
      name: 'helius',
      url: wsUrl,
      onOpen: () => this.subscribeAll(),
      onMessage: (raw) => this.handleMessage(raw),
      onDegraded: options.onDegraded,
    });
  }

  connect(): void {
    this.client.connect();
  }

  stop(): void {
    this.client.stop();
  }

  getHealth(): ConnectionHealth {
    return this.client.getHealth();
  }

  private subscribeAll(): void {
    this.pendingRequests.clear();
    this.subscriptions.clear();

    for (const [label, programId] of Object.entries(this.programIds)) {
      const id = this.nextRequestId++;
      this.pendingRequests.set(id, label);
      this.client.send({
        jsonrpc: '2.0',
        id,
        method: 'logsSubscribe',
        params: [{ mentions: [programId] }, { commitment: 'confirmed' }],
      });
    }
    logger.info('[helius] logsSubscribe sent', { programCount: Object.keys(this.programIds).length });
  }

  private handleMessage(raw: string): void {
    let message: HeliusMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      logger.warn('[helius] failed to parse message', { rawLength: raw.length });
      return;
    }

    if (isSubscribeResponse(message)) {
      const label = this.pendingRequests.get(message.id);
      if (label) {
        this.subscriptions.set(message.result, label);
        this.pendingRequests.delete(message.id);
      }
      return;
    }

    if (isLogsNotification(message)) {
      this.handleLogsNotification(message);
    }
  }

  private handleLogsNotification(message: HeliusLogsNotification): void {
    const { subscription, result } = message.params;
    const label = this.subscriptions.get(subscription);
    if (!label) return;

    const { signature, logs, err } = result.value;
    if (err) return; // Only classify successful transactions.

    const match = matchLogsForProgram(label, logs);
    if (!match) return;

    const event = normalizeHeliusLogMatch(signature, label, match);
    if (event) {
      this.onRawEvent(event);
    } else {
      // Classified but no mint could be derived from raw logs — expected in
      // v1 (see helius-log-matchers.ts). Logged at debug so operators can see
      // the connection is live and classifying even though most matches are
      // dropped before reaching the pipeline.
      logger.debug('[helius] classified match dropped (no mint derivable)', { label, eventType: match.eventType, signature });
    }
  }
}
