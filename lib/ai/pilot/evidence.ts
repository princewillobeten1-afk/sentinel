import { createHash } from 'node:crypto';
import type { MetricEvidence } from '@/lib/discovery/types';
import type { ChartSnapshot } from '@/lib/market/chart-model';
import { CHART_SECONDS } from '@/lib/market/chart-model';
import type { EvidenceFact, PilotAnswer } from './contracts';
import { answerSchema } from './contracts';
import { unsafeAnswer } from './privacy';

export function fact(input: Omit<EvidenceFact, 'id' | 'status' | 'observedAt' | 'expiresAt'>, evidence?: MetricEvidence, now = Date.now()): EvidenceFact {
  const at = evidence?.observedAt && Number.isFinite(Date.parse(evidence.observedAt)) && Date.parse(evidence.observedAt) <= now + 30000 ? evidence.observedAt : null;
  const value = input.value === undefined || typeof input.value === 'number' && !Number.isFinite(input.value) ? null : input.value;
  const validExpiry = !evidence?.expiresAt || Number.isFinite(Date.parse(evidence.expiresAt));
  const known = value !== null && at && validExpiry && (evidence?.status === 'measured' || evidence?.status === 'stale');
  const status = !known ? 'unavailable' : evidence?.status === 'stale' || evidence?.expiresAt && Date.parse(evidence.expiresAt) <= now ? 'stale' : 'measured';
  const row = { ...input, value: known ? value : null, status, observedAt: at, expiresAt: evidence?.expiresAt ?? null } as EvidenceFact;
  return { ...row, id: 'e_' + createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0,20) };
}
export function numeric(value: unknown): number | null {
  if (value === null || value === undefined || typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
export function chartFacts(snapshot: ChartSnapshot): EvidenceFact[] {
  const bars = snapshot.candles;
  const evidence: MetricEvidence = { status: snapshot.status, source: snapshot.source, observedAt: new Date(snapshot.observedAt).toISOString(), expiresAt: new Date(snapshot.observedAt + 60000).toISOString() };
  const result: EvidenceFact[] = [];
  const add = (metric: string, label: string, value: number | string | null, unit = 'USD') => result.push(fact({ mint: snapshot.address, metric, label, value, unit, category: 'chart' }, evidence));
  add('series', 'Candle scope', snapshot.market === 'pool' ? 'Pool-specific USD series' : 'Token-wide USD series', '');
  add('bars', 'Measured candles', bars.length, 'candles');
  add('close', 'Last measured close', bars.at(-1)?.close ?? null);
  const closes = bars.map(b => b.close);
  const contiguous = bars.every((b, i) => !i || b.time - bars[i-1].time === CHART_SECONDS[snapshot.timeframe]);
  const recentClosed = bars.length > 0 && Date.now() / 1000 - bars.at(-1)!.time < CHART_SECONDS[snapshot.timeframe] * 2;
  const sufficient = contiguous && recentClosed;
  let ema: number | null = null, rsi: number | null = null, upper: number | null = null, lower: number | null = null;
  if (sufficient && closes.length >= 20) {
    ema = closes.slice(0,20).reduce((a,b) => a+b,0) / 20;
    for (const close of closes.slice(20)) ema = close * 2/21 + ema * 19/21;
    const tail = closes.slice(-20), mean = tail.reduce((a,b) => a+b,0)/20;
    const deviation = Math.sqrt(tail.reduce((a,b) => a + (b-mean)**2,0)/20);
    upper = mean+2*deviation; lower = mean-2*deviation;
  }
  if (sufficient && closes.length >= 15) {
    let gain = 0, loss = 0;
    for (let i=1;i<closes.length;i++) {
      const delta=closes[i]-closes[i-1];
      if (i<=14) { gain+=Math.max(delta,0)/14; loss+=Math.max(-delta,0)/14; }
      else { gain=(gain*13+Math.max(delta,0))/14; loss=(loss*13+Math.max(-delta,0))/14; }
    }
    rsi = loss === 0 ? gain === 0 ? 50 : 100 : 100-100/(1+gain/loss);
  }
  add('ema20','EMA (20)',ema); add('rsi14','RSI (14)',rsi,'index'); add('bollUpper','Bollinger upper',upper); add('bollLower','Bollinger lower',lower);
  return result;
}
export function changedFacts(current: EvidenceFact[], prior: EvidenceFact[], now = Date.now()) {
  return current.flatMap(next => {
    const prev = prior.find(p => p.metric === next.metric && p.mint === next.mint && p.unit === next.unit);
    if (!prev || prev.status !== 'measured' || next.status !== 'measured' || typeof prev.value !== 'number' || typeof next.value !== 'number'
      || !prev.observedAt || !next.observedAt || Date.parse(prev.observedAt) >= Date.parse(next.observedAt)) return [];
    return [fact({ mint: next.mint, metric: 'delta.'+next.metric, label: next.label+' change', value: next.value-prev.value, unit: next.unit, category: 'history' },
      { status: 'measured', source: 'recorded-observations', observedAt: next.observedAt, expiresAt: next.expiresAt ?? undefined }, now), prev, next];
  });
}
export function validateAnswer(raw: unknown, facts: EvidenceFact[]): PilotAnswer | null {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ids = new Set(facts.filter(f => f.value !== null).map(f => f.id));
  for (const section of parsed.data.sections) {
    if (unsafeAnswer(section.text) || section.evidenceIds.some(id => !ids.has(id)) || !section.evidenceIds.length && section.title !== 'Limitations') return null;
  }
  return { ...parsed.data, validated: true };
}
export const evidenceOnlyAnswer = (): PilotAnswer => ({ validated: false, sections: [{ title: 'Limitations', text: 'A grounded AI explanation could not be completed. Review the measured evidence below; missing information is not evidence of safety.', evidenceIds: [] }] });
