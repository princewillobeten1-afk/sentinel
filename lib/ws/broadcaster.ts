import 'server-only';

import { logger } from '@/lib/server/logger';
import { signalProcessor, type DiscoverySignal } from '@/lib/discovery/signal-processor';
import { broadcast } from './server';
import { buildTopic, type TopicKind } from './topics';

/**
 * Bridges the existing, already-real event bus
 * (`MarketEventPipeline` → `SignalProcessor`, fed by the Birdeye/Helius
 * streaming layer built earlier) to WebSocket subscribers.
 *
 * Nothing new is computed here — `signalProcessor.on('*')` is an existing
 * registration API that had no production consumer before this sprint. This
 * is that consumer.
 */

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
  private unsubscribe: (() => void) | null = null;

  start(): void {
    if (this.unsubscribe) return;

    this.unsubscribe = signalProcessor.on('*', (signal) => {
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
    });

    logger.info('[ws] broadcaster attached to signalProcessor');
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

const globalForBroadcaster = globalThis as unknown as { wsBroadcaster?: WsBroadcaster };
export const wsBroadcaster = globalForBroadcaster.wsBroadcaster ?? new WsBroadcaster();
if (process.env.NODE_ENV !== 'production') globalForBroadcaster.wsBroadcaster = wsBroadcaster;
