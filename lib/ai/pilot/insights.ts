import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { EvidenceFact, PilotAnswer } from './contracts';

/** The model selects evidence-backed explanations, not arbitrary financial claims.
 * A valid citation alone cannot establish that a sentence is true. */
export const selectionSchema = z.object({ insightIds: z.array(z.string()).min(1).max(5) }).strict();
type Section = PilotAnswer['sections'][number];
export interface Insight extends Section { id: string }
export function buildInsights(facts: EvidenceFact[]): Insight[] {
  const result: Insight[] = [];
  const add = (title: Section['title'], text: string, evidenceIds: string[] = []) => {
    const id = 'i_' + createHash('sha256').update(JSON.stringify([title,text,evidenceIds])).digest('hex').slice(0,16);
    result.push({ id, title, text, evidenceIds });
  };
  add('Limitations','This analysis uses public evidence, not your holdings or trading history. It cannot establish that a token is safe or predict its future price.');
  add('Next step','Select or provide an exact token mint to assess a specific token. Symbols can identify multiple tokens.');
  add('Next step','Use Prepare trade to open the order panel. Enter amounts locally and review the live quote before any wallet approval.');
  const measured = facts.filter(f => f.value !== null && f.status === 'measured');
  if (measured.length) add('Overview','Measured public observations are available below. Check their observation times before acting.',measured.slice(0,12).map(f=>f.id));
  if (facts.some(f => f.value === null)) add('Limitations','Some requested evidence is not measured. Missing values do not mean zero and do not establish safety.');
  const stale = facts.filter(f=>f.status==='stale');
  if (stale.length) add('Caution','Some observations are stale. Refresh the evidence before treating them as current.',stale.slice(0,12).map(f=>f.id));
  for (const f of measured) {
    if (f.category === 'guide' && typeof f.value === 'string') add('Evidence',f.value,[f.id]);
    if (f.metric==='mintRevoked') add(f.value ? 'Evidence':'Caution',f.value ? 'The observed mint authority is revoked. This alone is not an overall safety assessment.' : 'The observed mint authority remains active. The authority can increase supply.',[f.id]);
    if (f.metric==='freezeRevoked') add(f.value ? 'Evidence':'Caution',f.value ? 'The observed freeze authority is revoked. Other risks still require review.' : 'The observed freeze authority remains active. Token accounts can be frozen by that authority.',[f.id]);
    if (f.metric==='lpLocked') add('Evidence',f.value ? 'The recorded liquidity-lock evidence indicates a lock. Review the audit for scope and expiry; a lock does not eliminate other risks.' : 'The recorded liquidity evidence does not indicate a lock. This is not proof that liquidity will be removed.',[f.id]);
    if (f.metric==='rsi14' && typeof f.value==='number') add('Evidence',f.value>70 ? 'Measured RSI is in the commonly called overbought range. That does not predict a reversal.' : f.value<30 ? 'Measured RSI is in the commonly called oversold range. That does not predict a rebound.' : 'Measured RSI is between the conventional overbought and oversold thresholds. This is not a trading signal by itself.',[f.id]);
    if (['snipers','insiders','bundlers'].includes(f.metric)) add('Caution','Holder classifications are heuristic estimates, not proof of wallet identity or coordination.',[f.id]);
    if (f.metric==='top10' && typeof f.value==='number' && f.value>=20) add('Caution','The largest holders account for a substantial share under Sentinel’s concentration review threshold. Pool and custody accounts may affect interpretation.',[f.id]);
    if (f.metric.startsWith('delta.') && typeof f.value==='number') add('Evidence',`${f.label} is ${f.value>0?'positive':f.value<0?'negative':'unchanged'} between the stored observations. This is a historical comparison, not a forecast.`,[f.id]);
    if (f.category==='creator') add('Evidence','The creator counts below cover recorded lifecycle events only. They do not establish wallet relationships or a complete launch history.',[f.id]);
    if (f.metric==='series') add('Evidence','Chart calculations use the measured USD candle series for the selected timeframe. They do not analyze a screenshot or infer missing candles.',[f.id]);
    if (f.metric==='discoveryMatch') add('Next step','The discovery results below match the validated filters in the currently indexed feed. Confirm the exact mint before continuing.',[f.id]);
  }
  const mints = new Set(measured.map(f=>f.mint).filter(Boolean));
  if (mints.size > 1) add('Evidence','Compare the labeled observations for each mint below. Daily volumes use the same window; stale or absent values cannot support a ranking.',measured.slice(0,12).map(f=>f.id));
  return result;
}
export function resolveSelection(raw: unknown, facts: EvidenceFact[]): PilotAnswer | null {
  const parsed=selectionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const permitted=new Map(buildInsights(facts).map(i=>[i.id,i]));
  if (parsed.data.insightIds.some(id=>!permitted.has(id))) return null;
  return { validated:true, sections:[...new Set(parsed.data.insightIds)].map(id=>{
    const { title,text,evidenceIds }=permitted.get(id)!;
    return { title,text,evidenceIds };
  }) };
}
