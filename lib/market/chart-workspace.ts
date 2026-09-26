import type { Chart, Overlay, OverlayCreate } from 'klinecharts';

export interface ChartTrade {
  id: string; timestamp: number; priceUsd: number; side: 'buy' | 'sell'; poolAddress?: string;
}
export const DRAWING_TOOLS = [
  { name: 'segment', label: 'Trend line' },
  { name: 'horizontalStraightLine', label: 'Horizontal line' },
  { name: 'rayLine', label: 'Ray' },
  { name: 'fibonacciLine', label: 'Fibonacci' },
] as const;
export interface StoredDrawing {
  name: string; id: string; points: { timestamp: number; value: number }[];
}
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
/** Total supply is not circulating supply. Only a measured circulating basis
 * or a single coherent cap/price snapshot may be used for an MCAP chart. */
export function marketCapBasis(circulatingSupply?: number, marketCap?: number, price?: number): number | undefined {
  if (positive(circulatingSupply)) return circulatingSupply;
  const factor = positive(marketCap) && positive(price) ? marketCap / price : undefined;
  return positive(factor) ? factor : undefined;
}
export function serializeDrawings(overlays: Overlay[], multiplier: number): StoredDrawing[] {
  if (!positive(multiplier)) return [];
  return overlays.filter(o => o.currentStep === -1 && DRAWING_TOOLS.some(t => t.name === o.name))
    .slice(0, 100).flatMap(o => {
      const points = o.points.map(p => ({ timestamp: p.timestamp!, value: p.value! / multiplier }));
      return points.length && points.every(p => positive(p.timestamp) && positive(p.value))
        ? [{ name: o.name, id: o.id, points }] : [];
    });
}
export function restoreDrawings(value: unknown, multiplier: number): OverlayCreate[] {
  if (!Array.isArray(value) || !positive(multiplier)) return [];
  return value.slice(0, 100).flatMap((d: StoredDrawing) => {
    if (!d || !DRAWING_TOOLS.some(t => t.name === d.name) || typeof d.id !== 'string'
      || !Array.isArray(d.points) || d.points.length < 1 || d.points.length > 10
      || !d.points.every(p => p && positive(p.timestamp) && positive(p.value) && positive(p.value * multiplier))) return [];
    return [{ name: d.name, id: d.id, groupId: 'drawings', paneId: 'candle_pane',
      points: d.points.map(p => ({ timestamp: p.timestamp, value: p.value * multiplier })) }];
  });
}
export interface ChartViewport { anchor: number | null; barSpace: number; following: boolean }
export function captureViewport(chart: Chart, following: boolean): ChartViewport {
  const data = chart.getDataList();
  const range = chart.getVisibleRange();
  const center = Math.max(0, Math.min(data.length - 1, Math.floor((range.from + range.to) / 2)));
  return { anchor: data[center]?.timestamp ?? null, barSpace: chart.getBarSpace().bar, following };
}
export function restoreViewport(chart: Chart, view: ChartViewport): void {
  chart.setBarSpace(view.barSpace);
  if (view.following || view.anchor === null) chart.scrollToRealTime(0);
  else {
    // scrollToTimestamp aligns to the rightmost slot. Compensate to preserve
    // the candle at the center, independently of prepended history length.
    chart.scrollToTimestamp(view.anchor, 0);
    const range = chart.getVisibleRange();
    chart.scrollByDistance(-((range.to - range.from) / 2) * view.barSpace, 0);
  }
}
