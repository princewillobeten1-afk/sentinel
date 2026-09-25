import { describe, expect, it } from 'vitest';
import { composeTokenAudit, isTokenAudit } from '../audit-model';
import { currentEvidence, currentRiskRating, rugRiskState } from '@/lib/discovery/audit-freshness';
import type { MetricEvidence, RugRiskEvidence } from '@/lib/discovery/types';

const now = Date.parse('2026-09-22T12:00:00Z');
const evidence: MetricEvidence = { status: 'measured', source: 'test-provider', observedAt: new Date(now - 1_000).toISOString(), expiresAt: new Date(now + 60_000).toISOString() };
const risk: RugRiskEvidence = { score: 0, level: 'low', completeness: 'complete', factors: [], version: 'test' };

describe('audit evidence contract', () => {
  it('keeps zero distinct from absent data and leaves unimplemented checks unverified', () => {
    const data = composeTokenAudit('mint', { devHoldingsPct: 0, ownershipEvidence: evidence }, null, null, evidence, false, now);
    expect(data.devBalancePct).toBe(0);
    expect(data.snipersPct).toBeNull();
    expect(data.honeypotTaxZero).toBeNull();
    expect(data.lpTokensBurned).toBeNull();
    expect(isTokenAudit(data, 'mint')).toBe(true);
    expect(isTokenAudit({ token: 'mint', holderAuditPending: false }, 'mint')).toBe(false);
  });
  it('does not use a market tick as an audit timestamp', () => {
    const data = composeTokenAudit('mint', { marketEvidence: evidence }, null, null,
      { ...evidence, status: 'unavailable' }, false, now);
    expect(data.lastAuditedAt).toBeNull();
    const metadataOnly = composeTokenAudit('mint', undefined, null, { id: 'mint', symbol: 'META' }, evidence, false, now);
    expect(metadataOnly.lastAuditedAt).toBeNull();
  });
  it('keeps fallback sources per field instead of attributing Jupiter facts to Birdeye', () => {
    const data = composeTokenAudit('mint', { ownershipEvidence: { ...evidence, status: 'unavailable' } }, null,
      { audit: { topHoldersPercentage: 12, devBalancePercentage: 0, mintAuthorityDisabled: true } },
      { ...evidence, source: 'jupiter-tokens' }, false, now);
    expect(data.top10Evidence.source).toBe('jupiter-tokens');
    expect(data.devBalanceEvidence.source).toBe('jupiter-tokens');
    expect(data.mintAuthorityEvidence.source).toBe('jupiter-tokens');
    expect(data.ownershipEvidence.status).toBe('unavailable');
    expect(data.devMigrations).toBeNull();
  });
  it('keeps measured fields and the actual provider visible for a partial holder profile', () => {
    const holder = {
      mint: 'mint', top10Pct: 42, totalHolders: 20, devPct: null,
      snipersPct: null, insidersPct: null, bundlersPct: null,
      proTraders: null, kols: null, fetchedAt: now - 1_000,
      source: 'bitquery-balance-updates+solana-rpc-supply',
    };
    const data = composeTokenAudit('mint', undefined, holder, null, evidence, false, now);
    expect(data.top10HoldersPct).toBe(42);
    expect(data.ownershipEvidence).toMatchObject({ status: 'measured', source: holder.source });
    expect(data.snipersPct).toBeNull();
  });
  it('expires on the boundary and fails closed for missing or invalid timestamps', () => {
    expect(currentEvidence(evidence, now + 60_000).status).toBe('stale');
    expect(currentEvidence({ ...evidence, expiresAt: 'invalid' }, now).status).toBe('stale');
    expect(currentEvidence({ ...evidence, observedAt: '' }, now).status).toBe('unavailable');
    expect(currentEvidence(undefined, now).status).toBe('unavailable');
  });
  it('requires current ownership, authorities AND liquidity for a complete risk label', () => {
    expect(rugRiskState(risk, [evidence, evidence, evidence], now)).toBe('measured');
    expect(rugRiskState(risk, [evidence, evidence, undefined], now)).toBe('partial');
    expect(rugRiskState(risk, [evidence, evidence, evidence], now + 60_000)).toBe('stale');
    expect(currentRiskRating(risk, [undefined, undefined, undefined])).toBe('unknown');
    expect(rugRiskState(risk, [evidence, { ...evidence, status: 'unavailable' }, evidence], now)).toBe('stale');
  });
});
