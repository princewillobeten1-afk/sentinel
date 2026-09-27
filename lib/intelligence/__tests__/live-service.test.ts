import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { composeTokenAudit } from '@/lib/trading/audit-model';
const state = vi.hoisted(() => ({ audit: vi.fn(), metadata: vi.fn(), primary: vi.fn(), hydrate: vi.fn(), card: vi.fn(), feed: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/trading/audit-service', () => ({ getTokenAudit: state.audit, getAuditMetadata: state.metadata }));
vi.mock('@/lib/market/live/card-cache', () => ({ getTokenCardPatch: state.card, hydrateTokenCards: state.hydrate }));
vi.mock('@/lib/api/birdeye/stats', () => ({ getTokenOverview: state.primary }));
vi.mock('@/lib/discovery/live-solana-feed', () => ({ fetchLiveSolanaTokens: state.feed }));
vi.mock('@/lib/server/db/pool', () => ({ isPostgresConfigured: () => true, dbPool: { query: state.query } }));
vi.mock('@/lib/server/logger', () => ({ logger: { debug: vi.fn() } }));
const mint = 'So11111111111111111111111111111111111111112';
const evidence = () => ({ status: 'measured' as const, source: 'jupiter', observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() });
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.stubEnv('BIRDEYE_API_KEY', 'fixture-not-a-key');
  state.hydrate.mockResolvedValue(undefined); state.feed.mockResolvedValue([]); state.card.mockReturnValue(undefined);
  state.audit.mockResolvedValue(composeTokenAudit(mint, undefined, null, null, evidence(), false));
  state.metadata.mockReturnValue({ token: { id: mint, symbol: 'SOL', usdPrice: 100 }, evidence: evidence() });
  state.primary.mockResolvedValue({ address: mint, price: 110, symbol: 'SOL' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
it('coalesces concurrent exact-mint lookups and caches primary requests', async () => {
  const { getLiveIntelligence } = await import('../live-service');
  const reports = await Promise.all([getLiveIntelligence('solana', mint), getLiveIntelligence('solana', mint)]);
  expect(state.audit).toHaveBeenCalledTimes(1); expect(state.primary).toHaveBeenCalledTimes(1);
  expect(reports[0]).toEqual(reports[1]); expect(reports[0].metrics.find(m => m.id === 'price')?.value).toBe(110);
  await getLiveIntelligence('solana', mint); expect(state.primary).toHaveBeenCalledTimes(1);
});
it('keeps real fallback observations when the primary entitlement fails', async () => {
  state.primary.mockRejectedValue(new Error('Birdeye 403 secret diagnostics'));
  const { getLiveIntelligence } = await import('../live-service');
  const report = await getLiveIntelligence('solana', mint);
  expect(report.metrics.find(m => m.id === 'price')?.value).toBe(100);
  expect(JSON.stringify(report)).not.toMatch(/Birdeye|jupiter|secret diagnostics/);
});
it('rejects symbols and unsupported chains before any provider call', async () => {
  const { getLiveIntelligence } = await import('../live-service');
  await expect(getLiveIntelligence('solana', 'SOL')).rejects.toMatchObject({ code: 'INVALID_MINT' });
  await expect(getLiveIntelligence('ethereum', mint)).rejects.toMatchObject({ code: 'UNSUPPORTED_CHAIN' });
  expect(state.audit).not.toHaveBeenCalled(); expect(state.primary).not.toHaveBeenCalled();
});
it('rejects an unrelated primary response rather than attaching its price', async () => {
  state.primary.mockResolvedValue({ address: mint.toUpperCase(), price: 999 });
  const { getLiveIntelligence } = await import('../live-service');
  const report = await getLiveIntelligence('solana', mint);
  expect(report.metrics.find(m => m.id === 'price')?.value).toBe(100);
});
it('returns an honest empty candidate list without sample tokens', async () => {
  const { getIntelligenceCandidates } = await import('../live-service');
  expect(await getIntelligenceCandidates()).toEqual([]);
  await getIntelligenceCandidates(); expect(state.feed).toHaveBeenCalledTimes(1);
});
it('reads actual parameterized observation history without exposing raw evidence', async () => {
  state.query.mockResolvedValue({ rows: [{ evidence_group: 'ownership', observed_at: '2026-09-27T10:00:00Z', evidence: { source: 'rugcheck' } }] });
  const { getIntelligenceHistory } = await import('../live-service');
  expect(await getIntelligenceHistory('solana', mint)).toEqual({ status: 'measured', observations: [{ category: 'ownership', observedAt: '2026-09-27T10:00:00.000Z' }] });
  expect(state.query.mock.calls[0][1]).toEqual([mint]);
});
it('does not invent historical snapshots when storage fails', async () => {
  state.query.mockRejectedValue(new Error('database private endpoint'));
  const { getIntelligenceHistory } = await import('../live-service');
  expect(await getIntelligenceHistory('solana', mint)).toEqual({ status: 'unavailable', observations: [] });
});
it('continues with measured evidence when cache hydration stalls', async () => {
  vi.useFakeTimers(); state.hydrate.mockReturnValue(new Promise(() => {}));
  const { getLiveIntelligence } = await import('../live-service');
  const pending = getLiveIntelligence('solana', mint);
  await vi.advanceTimersByTimeAsync(1001);
  expect((await pending).metrics.find(m => m.id === 'price')?.value).toBe(110);
});
