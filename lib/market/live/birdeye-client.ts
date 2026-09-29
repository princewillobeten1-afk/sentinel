import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import type { RawMarketEvent } from '@/lib/market/event-pipeline';
import { ReconnectingWebSocketClient } from './ws-client';
import { normalizeBirdeyePrice, normalizeBirdeyeTokenStats, normalizeBirdeyeTx } from './normalizers';
import type { BirdeyeMessage, ConnectionHealth } from './types';
import { getTokenCardPatch, updateTokenCard } from './card-cache';
import { calculateRugRisk, RUG_RISK_VERSION } from '@/lib/market/enrichment/rug-risk';
import { lifecycleWorker } from '@/lib/market/lifecycle/lifecycle-worker';
import { eventBus } from '@/lib/server/events/event-bus';
import { EVENT_TYPES } from '@/lib/server/events/event-types';
import { publishBirdeyeCandle, type ChartDemand } from './chart-stream';

/**
 * Only these two channels are wired for v1. Birdeye also exposes
 * SUBSCRIBE_LARGE_TRADE_TXS, SUBSCRIBE_NEW_PAIR, SUBSCRIBE_TOKEN_NEW_LISTING,
 * SUBSCRIBE_BASE_QUOTE_PRICE and others — extensible later, not needed now.
 */
const PRICE_SUBSCRIBE_TYPE = 'SUBSCRIBE_PRICE';
const TXS_SUBSCRIBE_TYPE = 'SUBSCRIBE_TXS';
const STATS_SUBSCRIBE_TYPE = 'SUBSCRIBE_TOKEN_STATS';
const ACCESS_RETRY_MS = 15 * 60_000;
const SUBSCRIPTION_RETRY_MS = 60_000;

/** Upstream errors may contain credentials, so only return fixed internal labels. */
export function classifyBirdeyeWebSocketError(message: { data?: unknown; statusCode?: unknown }): {
  reason: string; retryMs: number;
} {
  const detail = JSON.stringify(message.data ?? '');
  if (/compute\s*units?|quota|usage\s*limit/i.test(detail)) {
    return { reason: 'Market stream compute-unit quota is exhausted.', retryMs: ACCESS_RETRY_MS };
  }
  if (/api.?key|origin|permission|package|premium|plan|unauthori[sz]ed|forbidden/i.test(detail)
    || message.statusCode === 401 || message.statusCode === 403) {
    return { reason: 'Market stream access was rejected; check the credential, plan, and compute-unit quota.', retryMs: ACCESS_RETRY_MS };
  }
  return { reason: 'Market stream subscription was rejected.', retryMs: SUBSCRIPTION_RETRY_MS };
}

export function buildBirdeyeSubscriptions(mints: string[], charts: ChartDemand[] = [], includeHolderData = true): Record<string, unknown>[] {
  // Active charts get budget first; the entire price query is rebuilt atomically.
  const visible = [...new Set([...charts.map(chart => chart.mint), ...mints.filter(Boolean)])].slice(0, 100);
  if (visible.length === 0) {
    return [
      { type: 'UNSUBSCRIBE_PRICE' },
      { type: 'UNSUBSCRIBE_TXS' },
      { type: 'UNSUBSCRIBE_TOKEN_STATS' },
      { type: 'SUBSCRIBE_NEW_PAIR' },
    ];
  }
  const queries = [...new Set([
    ...charts.filter(chart => visible.includes(chart.mint)).map(chart => `${chart.mint}:${chart.timeframe}`),
    ...visible.map(mint => `${mint}:1m`),
  ])].slice(0, 100);
  const priceQuery = queries.map(query => {
    const [mint, timeframe] = query.split(':');
    return `(address = ${mint} AND chartType = ${timeframe} AND currency = usd)`;
  }).join(' OR ');
  const txQuery = visible.map((mint) => `address = ${mint}`).join(' OR ');
  return [
    { type: PRICE_SUBSCRIBE_TYPE, data: { queryType: 'complex', query: priceQuery } },
    { type: TXS_SUBSCRIBE_TYPE, data: { queryType: 'complex', query: txQuery } },
    {
      type: STATS_SUBSCRIBE_TYPE,
      data: {
        address: visible,
        select: {
          price: true,
          trade_data: { volume: true, trade: true, price_change: true, intervals: ['5m', '1h', '24h'] },
          fdv: true,
          marketcap: true,
          liquidity: true,
          last_trade: true,
          ...(includeHolderData ? { holder_data: true } : {}),
        },
      },
    },
    { type: 'SUBSCRIBE_NEW_PAIR' },
  ];
}

export interface BirdeyeClientOptions {
  mints: string[];
  onRawEvent: (event: RawMarketEvent) => void;
  onDegraded: (reason: string) => void;
}

export class BirdeyeClient {
  private readonly client: ReconnectingWebSocketClient;
  private mints: string[];
  private readonly onRawEvent: (event: RawMarketEvent) => void;
  private readonly onDegraded: (reason: string) => void;
  private providerError: string | undefined;
  private charts: ChartDemand[] = [];
  private holderDataEnabled = true;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pausedUntil = 0;
  private stopped = false;

  constructor(options: BirdeyeClientOptions) {
    this.mints = options.mints;
    this.onRawEvent = options.onRawEvent;
    this.onDegraded = options.onDegraded;

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
    this.stopped = false;
    this.client.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.pausedUntil = 0;
    this.client.stop();
  }

  getHealth(): ConnectionHealth {
    return { ...this.client.getHealth(), ...(this.providerError ? { providerError: this.providerError } : {}),
      ...(this.pausedUntil > Date.now() ? { pausedUntil: new Date(this.pausedUntil).toISOString() } : {}) };
  }

  /** Replaces the visible-mint set and atomically rebuilds each Birdeye subscription. */
  setMints(mints: string[], charts: ChartDemand[] = []): void {
    const next = [...new Set(mints.filter(Boolean))].slice(0, 100);
    if (next.join(',') === this.mints.join(',') && JSON.stringify(charts) === JSON.stringify(this.charts)) return;
    this.mints = next;
    this.charts = charts;
    this.subscribeAll();
  }

  private subscribeAll(): void {
    if (this.stopped || this.pausedUntil > Date.now()) return;
    // Birdeye allows one active subscription per message type. Repeating a
    // simple subscribe in a loop overwrites the previous mint, which meant
    // only the final card in the array actually received data.
    for (const message of buildBirdeyeSubscriptions(this.mints, this.charts, this.holderDataEnabled)) this.client.send(message);
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

    if (message.type === 'ERROR') {
      const detail = JSON.stringify((message as { data?: unknown }).data ?? '');
      if (this.holderDataEnabled && /holder_data|invalid select/i.test(detail)) {
        // A rollout or plan mismatch must not also remove the older market
        // fields. Retry the complete visible set without the new selector.
        this.holderDataEnabled = false;
        logger.warn('[birdeye] holder-data selector rejected; retaining legacy stats subscription');
        this.subscribeAll();
        return;
      }
      const rejection = classifyBirdeyeWebSocketError(message);
      if (this.pausedUntil > Date.now()) return;
      this.providerError = rejection.reason;
      this.pausedUntil = Date.now() + rejection.retryMs;
      this.client.stop();
      this.onDegraded(rejection.reason);
      logger.warn('[birdeye] subscription paused', { reason: rejection.reason, retryMs: rejection.retryMs });
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.pausedUntil = 0;
        if (!this.stopped) this.client.connect();
      }, rejection.retryMs);
      this.retryTimer.unref?.();
      return;
    }

    if (message.type === 'NEW_PAIR_DATA') {
      const pair = (message as unknown as {
        data?: {
          address?: string;
          source?: string;
          base?: { address?: string; name?: string; symbol?: string };
          txHash?: string;
          blockTime?: number;
        };
      }).data;
      const mint = pair?.base?.address;
      if (!mint) return;
      // A new AMM pool is not necessarily a newly launched token. The curve
      // worker only understands pump.fun launches; do not reclassify an
      // existing migrated token when someone creates another pool for it.
      const pairSource = pair.source?.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (pairSource !== 'pumpfun' && pairSource !== 'pumpdotfun') return;
      const observedAt = new Date(typeof pair.blockTime === 'number' ? pair.blockTime * 1_000 : Date.now()).toISOString();
      lifecycleWorker.onPairCreated(mint);
      updateTokenCard(mint, {
        lifecycleState: 'new_pairs',
        liquidityPoolAddress: pair.address,
        lifecycleEvidence: {
          status: 'measured',
          source: 'birdeye-new-pair-ws',
          observedAt,
        },
      }, 'birdeye-new-pair-ws', 'fresh', observedAt);
      const event = {
        id: `birdeye_pair_${pair.txHash ?? `${mint}_${pair.blockTime ?? Date.now()}`}`,
        sequence: 0,
        type: EVENT_TYPES.TOKEN_CREATED,
        timestamp: Date.parse(observedAt),
        signature: pair.txHash,
        mint,
        name: pair.base?.name,
        symbol: pair.base?.symbol,
        pool: pair.address,
        dex: pair.source,
        source: 'birdeye',
        commitment: 'confirmed',
      } as const;
      void eventBus.claimEventShared(event.id).then((isNew) => isNew ? eventBus.publish(event) : undefined);
      return;
    }

    const stats = normalizeBirdeyeTokenStats(message);
    if (stats) {
      this.providerError = undefined;
      const expiresAt = new Date(Date.parse(stats.observedAt) + 90_000).toISOString();
      const previous = getTokenCardPatch(stats.mint)?.changedFields;
      const merged = { ...previous, ...stats.fields };
      const ownershipChanged = ['top10HoldingsPct', 'devHoldingsPct', 'sniperPercentage', 'insiderHoldingsPct', 'bundlerPercentage']
        .some((field) => field in stats.fields);
      const ownershipComplete = ['top10HoldingsPct', 'devHoldingsPct', 'sniperPercentage', 'insiderHoldingsPct',
        'bundlerPercentage', 'sniperCount', 'bundlerCount', 'insiderCount', 'devCount']
        .every((field) => field in stats.fields);
      const rugRisk = ownershipChanged ? calculateRugRisk({
        top10Pct: merged.top10HoldingsPct,
        devPct: merged.devHoldingsPct,
        snipersPct: merged.sniperPercentage,
        insidersPct: merged.insiderHoldingsPct,
        bundlersPct: merged.bundlerPercentage,
        mintAuthorityRevoked: merged.isMintRenounced,
        freezeAuthorityRevoked: merged.isFreezeDisabled,
        liquidityLocked: merged.isLiquidityLocked,
      }) : null;
      updateTokenCard(stats.mint, {
        ...stats.fields,
        ...(rugRisk ? { rugRisk, auditVersion: RUG_RISK_VERSION } : {}),
        ...(stats.hasMarketFields ? { marketEvidence: {
          status: 'measured',
          source: 'birdeye-token-stats-ws',
          observedAt: stats.observedAt,
          expiresAt,
        } } : {}),
        ...(stats.hasActivityFields ? { activityEvidence: {
          status: 'measured',
          source: 'birdeye-token-stats-ws',
          observedAt: stats.observedAt,
          expiresAt,
        } } : {}),
        ...(stats.hasOwnershipFields ? { ownershipEvidence: {
          status: 'measured',
          source: 'birdeye-token-stats-ws',
          observedAt: stats.observedAt,
          expiresAt: new Date(Date.parse(stats.observedAt) + 60_000).toISOString(),
          ...(ownershipComplete ? {} : { reason: 'Only classifications returned by the live stream are measured; omitted fields remain unknown.' }),
        } } : {}),
      }, 'birdeye-token-stats-ws', 'fresh', stats.observedAt);
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
      this.providerError = undefined;
      publishBirdeyeCandle(message, mint);
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
  const data = (message as { data?: { address?: string; tokenAddress?: string } }).data;
  return data?.address ?? data?.tokenAddress ?? null;
}
