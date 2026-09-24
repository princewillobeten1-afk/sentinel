/**
 * Pure translation layer: provider-specific WS messages → `RawMarketEvent`.
 *
 * No I/O, no imports of WS clients — this is the primary unit-test surface
 * for the streaming integration. Every function returns `null` on malformed
 * or unrecognized input rather than throwing, so a single unexpected message
 * from a provider never takes down the connection's message handler.
 */

import type { RawMarketEvent } from '@/lib/market/event-pipeline';
import { chainEventId } from '@/lib/market/event-identity';
import type {
  BirdeyeMessage,
  BirdeyePriceDataMessage,
  BirdeyeTxMessage,
  BirdeyeTokenStatsMessage,
  LogMatchResult,
} from './types';

// ────────────────────────────────────────────────────────────────────────────
// Birdeye
// ────────────────────────────────────────────────────────────────────────────

export function normalizeBirdeyePrice(mint: string, message: BirdeyeMessage): RawMarketEvent | null {
  if (message.type !== 'PRICE_DATA') return null;
  const data = (message as BirdeyePriceDataMessage).data;
  if (!data || typeof data.c !== 'number' || !Number.isFinite(data.c)) return null;

  const timestamp = Number.isFinite(data.unixTime) ? new Date(data.unixTime * 1000).toISOString() : new Date().toISOString();

  return {
    eventId: `birdeye_price_${mint}_${data.unixTime ?? Date.now()}`,
    providerId: 'birdeye_price_ws',
    mint,
    eventType: 'PRICE_UPDATE',
    priceUsd: String(data.c),
    // Birdeye `v` is base-token volume, not USD notional. Never relabel it.
    volumeUsd: Number.isFinite(data.v_usd ?? data.vUsd) ? String(data.v_usd ?? data.vUsd) : undefined,
    timestamp,
  };
}

export function normalizeBirdeyeTx(mint: string, message: BirdeyeMessage): RawMarketEvent | null {
  if (message.type !== 'TXS_DATA' && message.type !== 'TRANSACTION_DATA') return null;
  const data = (message as BirdeyeTxMessage).data;
  // Without a chain signature this cannot be deduplicated or verified as a trade.
  if (!data || !data.txHash) return null;

  const priceUsd = data.priceUsd ?? data.price;
  const volumeUsd = data.volumeUsd ?? data.volumeUSD ?? data.volume;
  const chainTimestamp = typeof data.blockUnixTime === 'number' && Number.isFinite(data.blockUnixTime)
    ? data.blockUnixTime * 1000 : undefined;
  const timestamp = chainTimestamp !== undefined
    ? new Date(chainTimestamp).toISOString()
    : new Date().toISOString();

  const side = data.side === 'buy' ? 'BUY' : data.side === 'sell' ? 'SELL' : undefined;
  const eventId = chainEventId({ signature: data.txHash, mint, kind: side ?? 'SWAP_UNRESOLVED' });
  if (!eventId) return null;

  return {
    eventId,
    providerId: 'birdeye_txs_ws',
    mint,
    eventType: 'SWAP',
    side,
    signature: data.txHash,
    chainTimestamp,
    wallet: data.owner,
    tokenAmount: typeof data.tokenAmount === 'number' && Number.isFinite(data.tokenAmount) ? data.tokenAmount : undefined,
    amountSol: typeof data.amountSol === 'number' && Number.isFinite(data.amountSol) ? data.amountSol : undefined,
    priceUsd: priceUsd !== undefined ? String(priceUsd) : undefined,
    volumeUsd: volumeUsd !== undefined ? String(volumeUsd) : undefined,
    timestamp,
  };
}

export interface NormalizedTokenStats {
  mint: string;
  observedAt: string;
  hasActivityFields: boolean;
  fields: {
    volume5mUsd?: string;
    buyVolume5mUsd?: number;
    sellVolume5mUsd?: number;
    priceUsd?: string;
    marketCapUsd?: string;
    liquidityUsd?: string;
    volume1hUsd?: string;
    volume24hUsd?: string;
    txCount5m?: number;
    txCount1h?: number;
    txCount24h?: number;
    buysCount?: number;
    sellsCount?: number;
    buysCount5m?: number;
    sellsCount5m?: number;
    buysCount1h?: number;
    sellsCount1h?: number;
    buysCount24h?: number;
    sellsCount24h?: number;
    priceChange5m?: number;
    priceChange1h?: number;
    priceChange24h?: number;
  };
}

/** Parses Birdeye's documented TOKEN_STATS_DATA without manufacturing gaps. */
export function normalizeBirdeyeTokenStats(message: BirdeyeMessage): NormalizedTokenStats | null {
  if (message.type !== 'TOKEN_STATS_DATA') return null;
  const data = (message as BirdeyeTokenStatsMessage).data;
  if (!data || typeof data.address !== 'string' || !data.address) return null;

  const fields: NormalizedTokenStats['fields'] = {};
  const putString = (key: 'priceUsd' | 'marketCapUsd' | 'liquidityUsd' | 'volume5mUsd' | 'volume1hUsd' | 'volume24hUsd', value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) fields[key] = String(value);
  };
  const putNumber = (key: 'buyVolume5mUsd' | 'sellVolume5mUsd' | 'txCount5m' | 'txCount1h' | 'txCount24h' | 'buysCount' | 'sellsCount' | 'buysCount5m' | 'sellsCount5m' | 'buysCount1h' | 'sellsCount1h' | 'buysCount24h' | 'sellsCount24h' | 'priceChange5m' | 'priceChange1h' | 'priceChange24h', value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) fields[key] = value;
  };

  putString('priceUsd', data.price);
  putString('marketCapUsd', data.marketcap);
  putString('liquidityUsd', data.liquidity);
  putString('volume5mUsd', data.volume_5m_usd);
  // Birdeye has emitted both orderings across token-stats payload versions.
  // Only use a field that is actually present; never infer a missing side.
  putNumber('buyVolume5mUsd', data.volume_buy_5m_usd ?? data.buy_volume_5m_usd);
  putNumber('sellVolume5mUsd', data.volume_sell_5m_usd ?? data.sell_volume_5m_usd);
  putString('volume1hUsd', data.volume_1h_usd);
  putString('volume24hUsd', data.volume_24h_usd);
  putNumber('txCount5m', data.trade_5m);
  putNumber('txCount1h', data.trade_1h);
  putNumber('txCount24h', data.trade_24h);
  // The card currently has one buy/sell pair. Use the shortest exact window
  // the stats subscription supplies, and identify it as 1h in the UI.
  putNumber('buysCount', data.buy_1h);
  putNumber('sellsCount', data.sell_1h);
  putNumber('buysCount5m', data.buy_5m);
  putNumber('sellsCount5m', data.sell_5m);
  putNumber('buysCount1h', data.buy_1h);
  putNumber('sellsCount1h', data.sell_1h);
  putNumber('buysCount24h', data.buy_24h);
  putNumber('sellsCount24h', data.sell_24h);
  putNumber('priceChange5m', data.price_change_5m_percent);
  putNumber('priceChange1h', data.price_change_1h_percent);
  putNumber('priceChange24h', data.price_change_24h_percent);

  if (Object.keys(fields).length === 0) return null;
  // `last_trade_unix_time` is the age of the latest trade, not the age of this
  // stats observation. Using it caused quiet-token snapshots to be rejected as
  // older than unrelated REST evidence forever.
  const observedMs = Date.now();
  const hasActivityFields = ['volume5mUsd', 'buyVolume5mUsd', 'sellVolume5mUsd', 'txCount5m', 'buysCount5m', 'sellsCount5m']
    .some((key) => key in fields);
  return { mint: data.address, fields, hasActivityFields, observedAt: new Date(observedMs).toISOString() };
}

// ────────────────────────────────────────────────────────────────────────────
// Helius
// ────────────────────────────────────────────────────────────────────────────

const LOG_MATCH_TO_EVENT_TYPE: Record<LogMatchResult['eventType'], RawMarketEvent['eventType']> = {
  SWAP: 'SWAP',
  LIQUIDITY_ADD: 'LIQUIDITY_ADD',
  LIQUIDITY_REMOVE: 'LIQUIDITY_REMOVE',
};

/**
 * Turns a classified log match into a `RawMarketEvent`. Returns `null` when
 * the matcher couldn't confidently extract a mint, since `RawMarketEvent.mint`
 * is required and a fabricated placeholder would corrupt downstream per-mint
 * aggregation (spec: never invent a fact the source didn't provide).
 */
export function normalizeHeliusLogMatch(
  signature: string,
  programLabel: string,
  match: LogMatchResult,
  provider: 'helius' | 'quicknode' = 'helius',
): RawMarketEvent | null {
  if (!match.mint) return null;

  const eventId = chainEventId({ signature, mint: match.mint,
    kind: match.eventType === 'SWAP' ? 'SWAP_UNRESOLVED' : LOG_MATCH_TO_EVENT_TYPE[match.eventType] });
  if (!eventId) return null;

  return {
    eventId,
    providerId: `${provider}_logs_${programLabel}`,
    mint: match.mint,
    eventType: LOG_MATCH_TO_EVENT_TYPE[match.eventType],
    signature,
    commitment: 'confirmed',
    priceUsd: match.priceUsd,
    volumeUsd: match.volumeUsd,
    timestamp: new Date().toISOString(),
  };
}
