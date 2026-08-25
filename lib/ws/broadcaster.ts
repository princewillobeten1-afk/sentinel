import 'server-only';

import { logger } from '@/lib/server/logger';
import { signalProcessor, type DiscoverySignal } from '@/lib/discovery/signal-processor';
import { broadcast } from './server';
import { buildTopic, type TopicKind } from './topics';
import { eventBus } from '@/lib/server/events/event-bus';
import type { NormalizedRealtimeEvent } from '@/lib/server/events/event-types';

/** Maps a discovery signal type onto the WS topic kind subscribers listen on. */
function topicKindForSignal(signal: DiscoverySignal): TopicKind | null {
  switch (signal.signalType) {
    case 'PRICE_VELOCITY':
      return 'token.price';
    case 'VOLUME_SURGE':
      return 'token.trade';
    case 'LIQUIDITY_CHANGE':
      return 'token.risk';
    default:
      return null;
  }
}

class WsBroadcaster {
  private unsubscribeSignal: (() => void) | null = null;
  private eventBusListener: ((event: NormalizedRealtimeEvent) => void) | null = null;

  start(): void {
    if (this.unsubscribeSignal || this.eventBusListener) return;

    // 1. Signal Processor Bridge (Real algorithmic alpha & anomaly signals)
    this.unsubscribeSignal = signalProcessor.on('*', (signal) => {
      const kind = topicKindForSignal(signal);
      if (!kind) return;

      broadcast(buildTopic(kind, signal.tokenId), {
        signalId: signal.id,
        signalType: signal.signalType,
        tokenId: signal.tokenId,
        tokenSymbol: signal.tokenSymbol,
        score: signal.score,
        confidence: signal.confidence,
        metadata: signal.metadata,
        createdAt: signal.createdAt,
      });

      // Forward signals to discovery feed
      broadcast('feed.discovery:all', {
        type: 'signal',
        signalType: signal.signalType,
        mint: signal.tokenId,
        symbol: signal.tokenSymbol,
        score: signal.score,
        timestamp: signal.createdAt,
      });
    });

    // 2. Real-time Event Bus Bridge (Live on-chain Solana DEX swaps & liquidity events)
    this.eventBusListener = (event: NormalizedRealtimeEvent) => {
      if (!event.mint) return;

      // Broadcast Trades to token.trade:<mint>
      if (event.type === 'BUY' || event.type === 'SELL') {
        const tradePayload = {
          type: event.type,
          signature: event.signature,
          mint: event.mint,
          side: event.type === 'BUY' ? 'BUY' : 'SELL',
          amount: event.amount,
          amountSol: event.amountSol,
          priceUsd: event.priceUsd,
          wallet: event.wallet,
          slot: event.slot,
          timestamp: event.timestamp,
        };

        broadcast(buildTopic('token.trade', event.mint), tradePayload);

        // Forward trade to discovery feeds
        broadcast('feed.discovery:all', tradePayload);
        broadcast('feed.discovery:trending', tradePayload);
      }

      // Broadcast Prices to token.price:<mint>
      if (event.priceUsd !== undefined) {
        const pricePayload = {
          type: 'PRICE_UPDATE',
          mint: event.mint,
          priceUsd: event.priceUsd,
          slot: event.slot,
          timestamp: event.timestamp,
          change24h: typeof event.extra?.priceChange24h === 'number' ? event.extra.priceChange24h : undefined,
        };

        broadcast(buildTopic('token.price', event.mint), pricePayload);
        broadcast('feed.discovery:all', pricePayload);
      }

      // Broadcast Liquidity/Risk updates to token.risk:<mint>
      const riskScore = typeof event.extra?.riskScore === 'number' ? event.extra.riskScore : undefined;
      if (event.type === 'LIQUIDITY_ADDED' || event.type === 'POOL_CREATED' || riskScore !== undefined) {
        const riskPayload = {
          type: event.type,
          mint: event.mint,
          riskScore,
          liquidityUsd: event.liquidityUsd,
          slot: event.slot,
          timestamp: event.timestamp,
        };

        broadcast(buildTopic('token.risk', event.mint), riskPayload);
        broadcast('feed.discovery:all', riskPayload);
        broadcast('feed.discovery:migrating', riskPayload);
        broadcast('feed.discovery:graduated', riskPayload);
      }

      // Broadcast real Token Creation to Discovery Feed
      if (event.type === 'TOKEN_CREATED') {
        const createPayload = {
          type: 'TOKEN_CREATED',
          mint: event.mint,
          name: event.name,
          symbol: event.symbol,
          dex: event.dex,
          priceUsd: event.priceUsd,
          liquidityUsd: event.liquidityUsd,
          slot: event.slot,
          timestamp: event.timestamp,
        };

        broadcast('feed.discovery:all', createPayload);
        broadcast('feed.discovery:new', createPayload);
      }
    };

    eventBus.on('event', this.eventBusListener);

    logger.info('[ws] broadcaster attached to real signalProcessor and eventBus');
  }

  stop(): void {
    this.unsubscribeSignal?.();
    this.unsubscribeSignal = null;
    if (this.eventBusListener) {
      eventBus.off('event', this.eventBusListener);
      this.eventBusListener = null;
    }
  }
}

const globalForBroadcaster = globalThis as unknown as { wsBroadcaster?: WsBroadcaster };
export const wsBroadcaster = globalForBroadcaster.wsBroadcaster ?? new WsBroadcaster();
if (process.env.NODE_ENV !== 'production') globalForBroadcaster.wsBroadcaster = wsBroadcaster;
