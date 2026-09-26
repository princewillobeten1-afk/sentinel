import 'server-only';

import { logger } from '@/lib/server/logger';
import { signalProcessor, type DiscoverySignal } from '@/lib/discovery/signal-processor';
import { broadcast } from './server';
import { buildTopic, type TopicKind } from './topics';
import { eventBus } from '@/lib/server/events/event-bus';
import type { NormalizedRealtimeEvent } from '@/lib/server/events/event-types';
import { dexScreenerBoostsService } from '@/lib/discovery/dexscreener-boosts';
import { onTokenCardPatch, updateTokenCard } from '@/lib/market/live/card-cache';
import { onChartFrame } from '@/lib/market/live/chart-stream';

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
  private unsubscribeBoost: (() => void) | null = null;
  private unsubscribeCard: (() => void) | null = null;
  private unsubscribeChart: (() => void) | null = null;

  start(): void {
    if (this.unsubscribeSignal || this.eventBusListener || this.unsubscribeBoost || this.unsubscribeCard) return;
    this.unsubscribeChart = onChartFrame(frame => broadcast(`token.ohlcv:${frame.address}:${frame.timeframe}`, frame));

    // One complete per-mint channel is the browser contract. Producers update
    // the cache; this bridge fans the patch out and the WS server replays the
    // cached value to late subscribers.
    this.unsubscribeCard = onTokenCardPatch((patch) => {
      broadcast(buildTopic('token.card', patch.mint), patch);
      if (patch.changedFields.lifecycleState) {
        // Discovery listens here, including for mints not yet visible. A card
        // topic alone cannot insert a newly migrated token into the column.
        const event = { type: 'LIFECYCLE_UPDATE', mint: patch.mint, observedAt: patch.observedAt };
        broadcast('feed.discovery:migrating', event);
        broadcast('feed.discovery:graduated', event);
      }
    });

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
          amountUsd: event.amountUsd,
          priceUsd: event.priceUsd,
          wallet: event.wallet,
          slot: event.slot,
          timestamp: event.timestamp,
        };

        broadcast(buildTopic('token.trade', event.mint), tradePayload);
        updateTokenCard(event.mint, {
          lastTradeSide: event.type,
          lastTradeAmountUsd: event.amountUsd,
          ...(event.priceUsd !== undefined ? { priceUsd: String(event.priceUsd) } : {}),
        }, event.source ?? 'on-chain', 'fresh', new Date(event.timestamp).toISOString());
        // Trades, prices and signals deliberately stay off `feed.discovery:*`.
        //
        // The Discover store treats any event on those topics as "this section
        // changed" and brings its next REST fetch forward (400ms debounce).
        // A trade on a token already listed is not a section change — the rows
        // come from REST either way — but forwarding every one made the page
        // refetch all five columns ~2.5 times a second instead of every 4s.
        // Per-token updates reach the cards through `token.*` topics, which is
        // what `use-live-token-updates` subscribes to.
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
        updateTokenCard(event.mint, {
          priceUsd: String(event.priceUsd),
          marketCapUsd: event.marketCapUsd !== undefined ? String(event.marketCapUsd) : undefined,
          liquidityUsd: event.liquidityUsd !== undefined ? String(event.liquidityUsd) : undefined,
          volume24hUsd: event.volume24hUsd !== undefined ? String(event.volume24hUsd) : undefined,
          priceChange24h: typeof event.extra?.priceChange24h === 'number' ? event.extra.priceChange24h : undefined,
          }, event.source ?? 'on-chain', 'fresh', new Date(event.timestamp).toISOString());
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
        updateTokenCard(event.mint, {
          liquidityUsd: event.liquidityUsd !== undefined ? String(event.liquidityUsd) : undefined,
          securityEvidence: {
            status: 'measured',
            source: event.source ?? 'on-chain',
            observedAt: new Date(event.timestamp).toISOString(),
          },
        }, event.source ?? 'on-chain');
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

    // 3. Real-time DexScreener Paid Boosts Bridge
    this.unsubscribeBoost = dexScreenerBoostsService.onBoost((boost) => {
      const boostPayload = {
        type: 'token_boost',
        mint: boost.tokenAddress,
        chainId: boost.chainId,
        isBoosted: true,
        // `isDexPaid` and `boostCountdown` were both here and both were made
        // up: a boost is not a paid listing (that is `/orders/v1`, checked
        // separately), and DexScreener publishes no boost expiry, so the
        // countdown was ticking toward an `expiresAt` we invented as
        // `now + 24h` on every sighting.
        totalAmount: boost.totalAmount,
        amount: boost.amount,
        firstSeenAt: boost.firstSeenAt,
        timestamp: Date.now(),
        links: boost.links,
      };

      // Broadcast to discovery channels
      broadcast('feed.discovery:all', boostPayload);
      broadcast('feed.discovery:new', boostPayload);
      broadcast('feed.discovery:trending', boostPayload);

      // Broadcast to token-specific topics
      broadcast(buildTopic('token.trade', boost.tokenAddress), boostPayload);
      broadcast(buildTopic('token.price', boost.tokenAddress), boostPayload);
      updateTokenCard(boost.tokenAddress, {
        isBoosted: true,
        boostAmount: boost.amount ?? boost.totalAmount,
      }, 'dexscreener-boosts');
    });

    logger.info('[ws] broadcaster attached to signalProcessor, eventBus, and dexScreenerBoosts');
  }

  stop(): void {
    this.unsubscribeChart?.();
    this.unsubscribeChart = null;
    this.unsubscribeSignal?.();
    this.unsubscribeSignal = null;
    if (this.eventBusListener) {
      eventBus.off('event', this.eventBusListener);
      this.eventBusListener = null;
    }
    this.unsubscribeBoost?.();
    this.unsubscribeBoost = null;
    this.unsubscribeCard?.();
    this.unsubscribeCard = null;
  }
}

const globalForBroadcaster = globalThis as unknown as { wsBroadcaster?: WsBroadcaster };
export const wsBroadcaster = globalForBroadcaster.wsBroadcaster ?? new WsBroadcaster();
if (process.env.NODE_ENV !== 'production') globalForBroadcaster.wsBroadcaster = wsBroadcaster;
