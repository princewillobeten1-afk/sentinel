import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import type { RawMarketEvent } from '@/lib/market/event-pipeline';
import { ReconnectingWebSocketClient } from './ws-client';
import { normalizeBirdeyePrice, normalizeBirdeyeTx } from './normalizers';
import type { BirdeyeMessage, ConnectionHealth } from './types';

/**
 * Only these two channels are wired for v1. Birdeye also exposes
 * SUBSCRIBE_LARGE_TRADE_TXS, SUBSCRIBE_NEW_PAIR, SUBSCRIBE_TOKEN_NEW_LISTING,
 * SUBSCRIBE_BASE_QUOTE_PRICE and others — extensible later, not needed now.
 */
const PRICE_SUBSCRIBE_TYPE = 'SUBSCRIBE_PRICE';
const TXS_SUBSCRIBE_TYPE = 'SUBSCRIBE_TXS';

export interface BirdeyeClientOptions {
  mints: string[];
  onRawEvent: (event: RawMarketEvent) => void;
  onDegraded: (reason: string) => void;
}

export class BirdeyeClient {
  private readonly client: ReconnectingWebSocketClient;
  private readonly mints: string[];
  private readonly onRawEvent: (event: RawMarketEvent) => void;

  constructor(options: BirdeyeClientOptions) {
    this.mints = options.mints;
    this.onRawEvent = options.onRawEvent;

    const apiKey = env.getRequiredEnv('BIRDEYE_API_KEY');

    this.client = new ReconnectingWebSocketClient({
      name: 'birdeye',
      url: `${env.BIRDEYE_WS_URL}?x-api-key=${apiKey}`,
      headers: {
        Origin: 'ws://public-api.birdeye.so',
        'Sec-WebSocket-Origin': 'ws://public-api.birdeye.so',
      },
      protocols: 'echo-protocol',
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
    for (const mint of this.mints) {
      this.client.send({
        type: PRICE_SUBSCRIBE_TYPE,
        data: { queryType: 'simple', chartType: '1m', address: mint, currency: 'usd', mode: 'both' },
      });
      this.client.send({
        type: TXS_SUBSCRIBE_TYPE,
        data: { address: mint },
      });
    }
    logger.info('[birdeye] subscribed', { mintCount: this.mints.length });
  }

  private handleMessage(raw: string): void {
    let message: BirdeyeMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      logger.warn('[birdeye] failed to parse message', { rawLength: raw.length });
      return;
    }

    // Birdeye's price/tx payloads don't echo back the subscribed mint at the
    // top level in every message variant, so we fall back to matching against
    // our tracked set when an address field is present, else attribute to the
    // sole tracked mint when there's only one (common case), else drop it —
    // we never guess a mint.
    const candidateAddress = extractAddress(message);
    const mint = candidateAddress ?? (this.mints.length === 1 ? this.mints[0] : null);
    if (!mint) return;

    const priceEvent = normalizeBirdeyePrice(mint, message);
    if (priceEvent) {
      this.onRawEvent(priceEvent);
      return;
    }

    const txEvent = normalizeBirdeyeTx(mint, message);
    if (txEvent) {
      this.onRawEvent(txEvent);
    }
  }
}

function extractAddress(message: BirdeyeMessage): string | null {
  const data = (message as { data?: { address?: string; owner?: string } }).data;
  return data?.address ?? data?.owner ?? null;
}
