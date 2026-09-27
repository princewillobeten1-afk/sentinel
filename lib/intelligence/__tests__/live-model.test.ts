import { describe, expect, it } from 'vitest';
import { buildLiveIntelligence, intelligenceMetric, isIntelligenceMint, measuredNumber, type IntelligenceInputs } from '../live-model';
import { composeTokenAudit } from '@/lib/trading/audit-model';
import type { MetricEvidence } from '@/lib/discovery/types';

const mint = 'So11111111111111111111111111111111111111112';
const now = Date.parse('2026-09-27T12:00:00Z');
const evidence: MetricEvidence = { status: 'measured', source: 'rugcheck', observedAt: new Date(now).toISOString(), expiresAt: new Date(now + 60_000).toISOString(), reason: 'Internal diagnostics must not escape' };
function input(): IntelligenceInputs { return { mint, audit: composeTokenAudit(mint, undefined, null, null, { status: 'unavailable', source: 'unknown', observedAt: '' }, false, now) }; }
describe('live Intelligence evidence boundary', () => {
  it.each([null, undefined, '', ' ', true, {}, [], '0x10', 'no', Infinity, NaN, -1])('rejects missing or invalid numbers: %s', value => expect(measuredNumber(value)).toBeNull());
  it('preserves measured zero, tiny values and false', () => {
    expect(intelligenceMetric('x', 'X', 'market', 'USD', 0, evidence, now).value).toBe(0);
    expect(intelligenceMetric('x', 'X', 'market', 'USD', '0.000000001', evidence, now).value).toBe(1e-9);
    expect(intelligenceMetric('x', 'X', 'security', 'boolean', false, evidence, now).value).toBe(false);
  });
  it('does not convert unknown data to zero or safe', () => {
    const report = buildLiveIntelligence(input(), now);
    expect(report.metrics.every(m => m.value === null)).toBe(true);
    expect(report.findings).toEqual([]); expect(report.coverage.measured).toBe(0);
    expect(report).not.toHaveProperty('overallScore'); expect(report).not.toHaveProperty('confidence');
  });
  it.each(['', 'bad-time', new Date(now + 60_000).toISOString()])('rejects invalid observation time %s', at => {
    expect(intelligenceMetric('x', 'X', 'market', 'USD', 1, { ...evidence, observedAt: at }, now).value).toBeNull();
  });
  it('retains stale observations without refreshing their timestamp', () => {
    const result = intelligenceMetric('x', 'X', 'market', 'USD', 2, evidence, now + 61_000);
    expect(result).toMatchObject({ value: 2, status: 'stale', observedAt: evidence.observedAt });
  });
  it('rejects out-of-range concentrations and malformed expiry', () => {
    expect(intelligenceMetric('x', 'X', 'ownership', '%', 101, evidence, now).value).toBeNull();
    expect(intelligenceMetric('x', 'X', 'market', 'USD', 1, { ...evidence, expiresAt: 'bad' }, now).value).toBeNull();
  });
  it('distinguishes pending from unavailable', () => {
    expect(intelligenceMetric('x', 'X', 'ownership', '%', null, { ...evidence, status: 'loading' }, now).status).toBe('loading');
    expect(intelligenceMetric('x', 'X', 'ownership', '%', null, evidence, now).status).toBe('unavailable');
  });
  it('returns findings traceable to real observations, without provider details', () => {
    const value = input();
    value.audit = composeTokenAudit(mint, { top10HoldingsPct: 80, devHoldingsPct: 10, isMintRenounced: false, ownershipEvidence: evidence, securityEvidence: evidence }, null, null, evidence, false, now);
    const report = buildLiveIntelligence(value, now);
    expect(report.findings.map(f => f.id)).toEqual(['top10', 'dev', 'mintRevoked']);
    expect(report.findings.every(f => f.evidenceIds.every(id => report.metrics.some(m => m.id === id && m.value !== null)))).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/rugcheck|birdeye|jupiter|Internal diagnostics/);
  });
  it('does not infer market cap from FDV or partial volume', () => {
    const value = input(); value.metadata = { token: { id: mint, fdv: 1e9, stats24h: { buyVolume: 100 } }, evidence };
    const report = buildLiveIntelligence(value, now);
    expect(report.metrics.find(m => m.id === 'marketCap')?.value).toBeNull();
    expect(report.metrics.find(m => m.id === 'volume24h')?.value).toBeNull();
  });
  it('uses exact mint addresses and never symbol resolution', () => {
    expect(isIntelligenceMint(mint)).toBe(true); expect(isIntelligenceMint('SOL')).toBe(false);
    expect(isIntelligenceMint('z'.repeat(44))).toBe(false);
    expect(buildLiveIntelligence(input(), now).token.mint).toBe(mint);
  });
  it('does not manufacture lifecycle proofs or creator relationships', () => {
    const value = input(); value.card = { mint, sequence: 1, observedAt: evidence.observedAt, source: 'helius', freshness: 'fresh', changedFields: { lifecycleState: 'migrated', migrationSignature: 'made-up' } };
    const result = buildLiveIntelligence(value, now);
    expect(result.lifecycle).toMatchObject({ state: null, signature: null });
    expect(result.token.creator).toBeNull();
  });
  it('prefers fresh fallback measurements to stale market fields', () => {
    const value = input(); value.metadata = { token: { id: mint, usdPrice: 2 }, evidence };
    value.card = { mint, sequence: 1, observedAt: evidence.observedAt, source: 'birdeye', freshness: 'stale', changedFields: { priceUsd: '1', marketEvidence: { ...evidence, status: 'stale' } } };
    expect(buildLiveIntelligence(value, now).metrics.find(m => m.id === 'price')?.value).toBe(2);
  });
  it('keeps measured primary market values ahead of metadata fallback', () => {
    const value = input(); value.metadata = { token: { id: mint, usdPrice: 2 }, evidence };
    value.card = { mint, sequence: 1, observedAt: evidence.observedAt, source: 'birdeye', freshness: 'fresh', changedFields: { priceUsd: '1', marketEvidence: evidence } };
    expect(buildLiveIntelligence(value, now).metrics.find(m => m.id === 'price')?.value).toBe(1);
  });
});
