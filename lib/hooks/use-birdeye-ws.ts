'use client';

import { useMemo, useEffect, useState } from 'react';
import { getSentinelWSClient } from './use-sentinel-ws';
import type { WsResponse, WsPriceDataResponse, WsTxsDataResponse } from '@/lib/api/birdeye/ws';

/**
 * Adapter hook that maps legacy Birdeye WS client calls to the internal Sentinel WebSocket gateway.
 * Prevents client-side API key leakage and external third-party socket connections.
 */
class SentinelBirdeyeAdapter {
  private handlers = new Set<(data: WsResponse) => void>();
  private priceSubscriptions = new Set<string>();
  private txsSubscriptions = new Set<string>();
  private cleanups: (() => void)[] = [];

  constructor() {
    const ws = getSentinelWSClient();
    ws.connect();

    // Listen to global server messages and translate to WsResponse
    const unsub = ws.onAll((msg) => {
      if (msg.type === 'event' && msg.topic && msg.data) {
        if (msg.topic.startsWith('token.price:')) {
          const address = msg.topic.replace('token.price:', '');
          const res: WsPriceDataResponse = {
            type: 'PRICE_DATA',
            data: {
              eventType: 'ohlcv',
              type: '1m',
              unixTime: Math.floor(Date.now() / 1000),
              address,
              c: typeof msg.data.priceUsd === 'number' ? msg.data.priceUsd : Number(msg.data.priceUsd || 0),
            },
          };
          this.emit(res);
        } else if (msg.topic.startsWith('token.trade:')) {
          const address = msg.topic.replace('token.trade:', '');
          const res: WsTxsDataResponse = {
            type: 'TXS_DATA',
            data: {
              blockUnixTime: Math.floor(Date.now() / 1000),
              owner: msg.data.wallet || 'unknown',
              source: 'Sentinel',
              txHash: msg.data.signature || `tx_${Date.now()}`,
              side: msg.data.side === 'BUY' ? 'buy' : 'sell',
              tokenAddress: address,
              volumeUSD: msg.data.priceUsd && msg.data.amount ? Number(msg.data.priceUsd) * Number(msg.data.amount) : undefined,
              pricePair: msg.data.priceUsd ? Number(msg.data.priceUsd) : undefined,
            },
          };
          this.emit(res);
        }
      }
    });

    this.cleanups.push(unsub);
  }

  public subscribe(payload: { type: string; data: { address?: string } }): void {
    const ws = getSentinelWSClient();
    if (!payload.data?.address) return;

    if (payload.type === 'SUBSCRIBE_PRICE') {
      this.priceSubscriptions.add(payload.data.address);
      ws.subscribe(`token.price:${payload.data.address}`);
    } else if (payload.type === 'SUBSCRIBE_TXS') {
      this.txsSubscriptions.add(payload.data.address);
      ws.subscribe(`token.trade:${payload.data.address}`);
    }
  }

  public unsubscribe(payload: { type: string; data: { address?: string } }): void {
    const ws = getSentinelWSClient();
    if (!payload.data?.address) return;

    if (payload.type === 'SUBSCRIBE_PRICE') {
      this.priceSubscriptions.delete(payload.data.address);
      ws.unsubscribe(`token.price:${payload.data.address}`);
    } else if (payload.type === 'SUBSCRIBE_TXS') {
      this.txsSubscriptions.delete(payload.data.address);
      ws.unsubscribe(`token.trade:${payload.data.address}`);
    }
  }

  public addHandler(handler: (data: WsResponse) => void): void {
    this.handlers.add(handler);
  }

  public removeHandler(handler: (data: WsResponse) => void): void {
    this.handlers.delete(handler);
  }

  private emit(data: WsResponse): void {
    for (const handler of this.handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error('[BirdeyeAdapter] Handler error:', e);
      }
    }
  }
}

let globalAdapter: SentinelBirdeyeAdapter | null = null;

export function useBirdeyeWS() {
  const [adapter] = useState<SentinelBirdeyeAdapter>(() => {
    if (!globalAdapter) {
      globalAdapter = new SentinelBirdeyeAdapter();
    }
    return globalAdapter;
  });

  return { client: adapter, isReady: true };
}
