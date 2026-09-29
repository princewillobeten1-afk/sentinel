import 'server-only';
import { createHash } from 'node:crypto';
import type { ChartFrame, ChartSnapshot } from '@/lib/market/chart-model';
import type { PublicChartFrame, PublicChartSnapshot } from '@/lib/market/public-chart';
import { publicAssetUrl } from './public-assets';

const vendor = /birdeye|helius|rugcheck|quicknode|geckoterminal|dexscreener|jupiter|solana[ -]?tracker|fluxrpc|bitquery/i;
const diagnosticKeys = new Set(['raw', 'rawPayload', 'rawResponse', 'rawSourceIdentifiers', 'fieldSources',
  'providerDiagnostics', 'providerHealth', 'endpoint', 'rpcUrl', 'wssUrl', 'apiKey', 'accessToken', 'shieldKey']);
const sourceKeys = new Set(['source', 'sources', 'provider', 'providerName', 'activeProviders', 'liveSource']);
const explanationKeys = new Set(['reason', 'failureReason', 'error', 'message', 'description', 'explanation', 'fact', 'factors', 'warnings']);
const imageKeys = new Set(['logoURI', 'logoUri', 'logoUrl', 'image', 'imageUrl', 'imageURI', 'icon', 'iconUrl']);
const sourceCategory = (value: string): string => /holder|ownership/.test(value) ? 'Ownership analysis'
  : /rugcheck|audit|security|risk/.test(value) ? 'Security analysis'
    : /helius|quicknode|rpc|on.?chain/.test(value) ? 'Blockchain data' : 'Market data';

export function publicMessage(message: string, fallback = 'Market data is temporarily unavailable. Please retry.'): string {
  return vendor.test(message) || /https?:\/\/|api[_ -]?key|credential|bearer /i.test(message) ? fallback : message;
}

function series(value: ChartSnapshot | ChartFrame) {
  const market = value.market ?? 'token-aggregate';
  const identity = `${value.address}:${market}:${market === 'pool' ? value.poolAddress : ''}`;
  return { market, seriesId: createHash('sha256').update(identity).digest('hex').slice(0, 24),
    priority: market === 'token-aggregate' ? 2 : 1,
    ...(market === 'pool' ? { poolAddress: value.poolAddress } : {}) };
}
export function publicChartSnapshot(value: ChartSnapshot): PublicChartSnapshot {
  return { ...series(value), address: value.address, chain: value.chain, timeframe: value.timeframe,
    currency: value.currency, candles: value.candles, hasMore: value.hasMore, oldestTime: value.oldestTime,
    observedAt: value.observedAt, status: value.status, deliveryMode: 'poll',
    ...(value.reason ? { reason: publicMessage(value.reason, 'Chart history is delayed. Retaining measured candles.') } : {}) };
}
export function publicChartFrame(value: ChartFrame): PublicChartFrame {
  return { ...series(value), address: value.address, timeframe: value.timeframe, candle: value.candle,
    observedAt: value.observedAt, provisional: value.provisional === true,
    deliveryMode: value.source.endsWith('-ws') ? 'stream' : 'poll' };
}

/** Field-aware public projection, not a JSON/string replacement. User text, DEX
 * venues, wallet addresses and transaction bytes are deliberately untouched.
 * Internal cached objects are never mutated. Both REST and WS use this adapter. */
export function publicData(value: unknown, field = ''): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (sourceKeys.has(field) && vendor.test(value)) return sourceCategory(value.toLowerCase());
    if (explanationKeys.has(field)) return publicMessage(value, 'Additional data is temporarily unavailable.');
    if (imageKeys.has(field)) return publicAssetUrl(value);
    if (/url|uri|href/i.test(field) && vendor.test(value)) return undefined;
    return value;
  }
  if (Array.isArray(value)) return value.map(item => publicData(item, field));
  if (typeof value !== 'object' || value instanceof Date) return value;
  const record = value as Record<string, unknown>;
  if (record.address && record.timeframe && typeof record.source === 'string') {
    if (Array.isArray(record.candles)) return publicChartSnapshot(value as ChartSnapshot);
    if (record.candle) return publicChartFrame(value as ChartFrame);
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (diagnosticKeys.has(key) || vendor.test(key)) continue;
    result[key] = publicData(entry, key);
  }
  // A token-stats frame carries both market and ownership measurements. The
  // public evidence label must follow its metric group, not the shared wire
  // subscription name (which remains server-only).
  if (field === 'ownershipEvidence' && typeof result.source === 'string') result.source = 'Ownership analysis';
  return result;
}
