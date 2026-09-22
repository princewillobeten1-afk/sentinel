import { parseChartTarget, parseProviderCandle, isChartTimeframe, type ChartFrame, type ChartTimeframe } from '@/lib/market/chart-model';

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
  state.frames.delete(target);
  state.frames.set(target, frame);
  if (state.frames.size > 500) state.frames.delete(state.frames.keys().next().value!);
  for (const listener of state.listeners) listener(frame);
  return frame;
}
export function resetChartStreamForTests() { state.refs.clear(); state.frames.clear(); state.listeners.clear(); state.demandListeners.clear(); }
