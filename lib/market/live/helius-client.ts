import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import type { RawMarketEvent } from '@/lib/market/event-pipeline';
import { ReconnectingWebSocketClient } from './ws-client';
import { matchLogsForProgram, matchLogsAnyProgram } from './helius-log-matchers';
import { normalizeHeliusLogMatch } from './normalizers';
import { enrichSignature } from './transaction-enricher';
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

  /**
   * The mint the enrichment budget is currently aimed at, if any.
   *
   * At the configured call rate the enricher cannot both sweep every DEX
   * program and keep up with one token's tape. When a token page is open the
   * broad program subscriptions are dropped and a single `mentions:[mint]`
   * subscription takes their place, so the whole budget goes to the token the
   * user is actually watching. Closing the page restores the sweep.
   */
  private focusedMint: string | null = null;

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

  getFocusedMint(): string | null {
    return this.focusedMint;
  }

  /**
   * Aim the stream at one mint. Idempotent for the same mint.
   *
   * Re-subscribes from scratch rather than layering a subscription on top:
   * leaving the program subscriptions active would keep the enricher's queue
   * saturated with unrelated swaps and starve the focused token of budget,
   * which is the entire problem this solves.
   */
  focusMint(mint: string): void {
    if (this.focusedMint === mint) return;
    this.focusedMint = mint;
    logger.info('[helius] focusing stream on a single mint', { mint });
    this.resubscribe();
  }

  /** Return to sweeping the tracked DEX programs. */
  clearFocus(): void {
    if (this.focusedMint === null) return;
    logger.info('[helius] releasing mint focus, resuming program sweep', { mint: this.focusedMint });
    this.focusedMint = null;
    this.resubscribe();
  }

  /** Drops every live subscription, then rebuilds for the current mode. */
  private resubscribe(): void {
    for (const subscriptionId of this.subscriptions.keys()) {
      this.client.send({
        jsonrpc: '2.0',
        id: this.nextRequestId++,
        method: 'logsUnsubscribe',
        params: [subscriptionId],
      });
    }
    this.subscribeAll();
  }

  private subscribeAll(): void {
    this.pendingRequests.clear();
    this.subscriptions.clear();

    // Focused mode: one subscription, every matching transaction enriched.
    if (this.focusedMint) {
      const id = this.nextRequestId++;
      this.pendingRequests.set(id, `focus:${this.focusedMint}`);
      this.client.send({
        jsonrpc: '2.0',
        id,
        method: 'logsSubscribe',
        params: [{ mentions: [this.focusedMint] }, { commitment: 'confirmed' }],
      });
      logger.info('[helius] logsSubscribe sent (focused)', { mint: this.focusedMint });
      return;
    }

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

    // A focused subscription is by mint, so its notifications can come from
    // any venue and there is no program label to pick a matcher with.
    const isFocused = label.startsWith('focus:');
    const match = isFocused ? matchLogsAnyProgram(logs) : matchLogsForProgram(label, logs);
    if (!match) return;

    const event = normalizeHeliusLogMatch(signature, label, match);
    if (event) {
      this.onRawEvent(event);
      return;
    }

    // No mint in the log text — the normal case, since `logsNotification`
    // carries no instruction data. Rather than drop the match (which left
    // `realtime_trades` empty while the socket looked healthy), fetch the
    // parsed transaction and read the mint and amounts out of its token
    // balance deltas.
    //
    // Fire-and-forget: this callback is driven by the socket and must not wait
    // on an RPC round-trip. The enricher is queue-bounded and rate-limited, so
    // a burst of matches cannot become a burst of requests — it drops rather
    // than queues without limit, and reports what it dropped.
    void enrichSignature(signature)
      .then((trade) => {
        if (!trade) return;
        this.onRawEvent({
          eventId: `helius_${signature}_${label}`,
          providerId: `helius_logs_${label}`,
          mint: trade.mint,
          eventType: match.eventType,
          priceUsd: trade.priceUsd,
          volumeUsd: trade.volumeUsd,
          // Measured from which way the token crossed the transaction
          // boundary, not assumed.
          side: match.eventType === 'SWAP' ? (trade.isBuy ? 'BUY' : 'SELL') : undefined,
          signature,
          wallet: trade.wallet,
          timestamp: new Date().toISOString(),
        });
      })
      .catch((err) => {
        logger.debug('[helius] enrichment failed', {
          signature,
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }
}
