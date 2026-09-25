import { CHART_SECONDS, parseChartTarget, parseChartSnapshot, parseProviderCandle, isChartTimeframe,
  type ChartFrame, type ChartSnapshot, type ChartTimeframe } from '@/lib/market/chart-model';

export interface ChartDemand { mint: string; timeframe: ChartTimeframe }
interface State {
  refs: Map<string, number>;
  demandListeners: Set<() => void>;
  frames: Map<string, ChartFrame>;
  listeners: Set<(frame: ChartFrame) => void>;
}
const globalCharts = globalThis as typeof globalThis & { __sentinelCharts?: State };
const state = globalCharts.__sentinelCharts ??= { refs: new Map(), demandListeners: new Set(), frames: new Map(), listeners: new Set() };

export function noteChartTopics(topics: Iterable<string>, direction: 1 | -1) {
  let changed = false;
  for (const topic of topics) {
    if (!topic.startsWith('token.ohlcv:')) continue;
    const target = topic.slice('token.ohlcv:'.length);
    if (!parseChartTarget(target)) continue;
    const previous = state.refs.get(target) ?? 0;
    const next = Math.max(0, previous + direction);
    if (next) state.refs.set(target, next); else state.refs.delete(target);
    if (!!previous !== !!next) changed = true;
  }
  if (changed) for (const listener of state.demandListeners) listener();
}
export function getChartDemand(): ChartDemand[] { return [...state.refs.keys()].map(target => parseChartTarget(target)!); }
export function onChartDemand(listener: () => void) { state.demandListeners.add(listener); return () => { state.demandListeners.delete(listener); }; }
export function onChartFrame(listener: (frame: ChartFrame) => void) { state.listeners.add(listener); return () => { state.listeners.delete(listener); }; }
export function getChartFrame(target: string) { return state.frames.get(target); }

/** Fan out a measured REST candle for either market, never crossing their identities. */
export function publishPolledCandle(snapshot: ChartSnapshot): ChartFrame | null {
  const target = `${snapshot.address}:${snapshot.timeframe}`;
  const measured = parseChartSnapshot(snapshot, snapshot.address, snapshot.timeframe);
  if (!state.refs.has(target) || !measured || measured.status !== 'measured') return null;
  const candle = measured.candles[measured.candles.length - 1];
  if (!candle) return null;
  const previous = state.frames.get(target);
  if (previous && (previous.candle.time > candle.time || previous.observedAt >= measured.observedAt
    || (previous.source === 'birdeye-price-ws' && Date.now() - previous.observedAt < 15_000)
    || (previous.source === 'quicknode-pool-ws' && Date.now() - previous.observedAt < 20_000))) return null;
  const frame: ChartFrame = { address: measured.address, timeframe: measured.timeframe,
    candle, observedAt: measured.observedAt,
    source: measured.market === 'pool' ? 'geckoterminal-pool-rest'
      : measured.source === 'bitquery-token-ohlcv' ? 'bitquery-ohlcv-rest'
        : measured.source === 'bitquery-dex-ohlcv' ? 'bitquery-dex-ohlcv-rest' : 'birdeye-ohlcv-rest',
    market: measured.market, ...(measured.poolAddress ? { poolAddress: measured.poolAddress } : {}) };
  saveFrame(target, frame);
  return frame;
}

/** Confirmed on-chain swap price. The bar's volume is deliberately unknown:
 * this stream can skip complex routes and GeckoTerminal later reconciles OHLCV. */
export function publishQuickNodeTrade(mint: string, poolAddress: string, priceUsd: number, observedAt: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0 || !Number.isFinite(observedAt) || observedAt <= 0) return 0;
  let published = 0;
  for (const { mint: watched, timeframe } of getChartDemand()) {
    if (watched !== mint) continue;
    const target = `${mint}:${timeframe}`;
    const seconds = CHART_SECONDS[timeframe];
    const time = Math.floor(observedAt / 1000 / seconds) * seconds;
    const previous = state.frames.get(target);
    if (previous && previous.candle.time > time) continue;
    // A pool swap must never displace a healthy Birdeye or Bitquery
    // token-aggregate candle. Pool updates are only valid for a pool series.
    if (previous?.market === 'token-aggregate') continue;
    if (previous?.source === 'quicknode-pool-ws' && previous.candle.time === time
      && previous.observedAt > observedAt) continue;
    const samePool = previous?.market === 'pool' && previous.poolAddress === poolAddress && previous.candle.time === time;
    const candle = { time,
      open: samePool ? previous.candle.open : priceUsd,
      high: samePool ? Math.max(previous.candle.high, priceUsd) : priceUsd,
      low: samePool ? Math.min(previous.candle.low, priceUsd) : priceUsd,
      close: priceUsd, volume: null, volumeUsd: null };
    saveFrame(target, { address: mint, timeframe, candle, observedAt, source: 'quicknode-pool-ws',
      market: 'pool', poolAddress, provisional: true });
    published += 1;
  }
  return published;
}

function saveFrame(target: string, frame: ChartFrame): void {
  state.frames.delete(target);
  state.frames.set(target, frame);
  if (state.frames.size > 500) state.frames.delete(state.frames.keys().next().value!);
  for (const listener of state.listeners) listener(frame);
}

/** Preserve complete provider OHLCV; the price normalizer intentionally only keeps close. */
export function publishBirdeyeCandle(message: any, mint: string): ChartFrame | null {
  if (message?.type !== 'PRICE_DATA') return null;
  const row = message.data;
  if (!row || row.eventType !== 'ohlcv' || !isChartTimeframe(row.type) || (row.address && row.address !== mint)
    || (row.currency && row.currency !== 'usd') || row.isScaled === true) return null;
  const target = `${mint}:${row.type}`;
  if (!state.refs.has(target)) return null;
  const candle = parseProviderCandle(row, row.type);
  if (!candle || candle.time > Date.now() / 1000 + 5) return null;
  const previous = state.frames.get(target);
  if (previous && previous.candle.time > candle.time) return null;
  const frame: ChartFrame = { address: mint, timeframe: row.type, candle, observedAt: Date.now(), source: 'birdeye-price-ws' };
  saveFrame(target, frame);
  return frame;
}
export function resetChartStreamForTests() { state.refs.clear(); state.frames.clear(); state.listeners.clear(); state.demandListeners.clear(); }
