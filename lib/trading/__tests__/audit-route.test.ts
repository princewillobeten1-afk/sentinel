import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ live: {} as Record<string, unknown>, pending: false }));
vi.mock('@/lib/market/enrichment/audit-worker', () => ({ getAudit: () => null, isAuditPending: () => state.pending, queueAudit: vi.fn() }));
vi.mock('@/lib/market/enrichment/security-worker', () => ({ queueSecurityTarget: vi.fn() }));
vi.mock('@/lib/market/live/card-cache', () => ({ getTokenCardPatch: () => ({ observedAt: new Date().toISOString(), changedFields: state.live }) }));
vi.mock('@/lib/server/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

const mint = 'So11111111111111111111111111111111111111112';
let GET: typeof import('@/app/api/v1/tokens/[chain]/[address]/audit/route').GET;
const request = async () => GET(new Request(`http://localhost/audit`), { params: { chain: 'solana', address: mint } });
const evidence = () => ({ status: 'measured', source: 'birdeye-holder-profile', observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); state.live = {}; state.pending = false;
  GET = (await import('@/app/api/v1/tokens/[chain]/[address]/audit/route')).GET;
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('rebuilds ALL audit fields on a metadata cache hit', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: mint, audit: { devBalancePercentage: 1 } }] });
  vi.stubGlobal('fetch', fetcher);
  expect((await (await request()).json()).data.devBalancePct).toBe(1);
  state.live = { top10HoldingsPct: 85, devHoldingsPct: 40, isMintRenounced: false, isFreezeDisabled: true,
    isLiquidityLocked: false, ownershipEvidence: evidence(), securityEvidence: evidence() };
  const res = await request();
  const { data } = await res.json();
  expect(data.top10HoldersPct).toBe(85);
  expect(data.devBalancePct).toBe(40);
  expect(data.mintAuthorityDisabled).toBe(false);
  expect(data.freezeAuthorityDisabled).toBe(true);
  expect(data.liquidityLocked).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(res.headers.get('cache-control')).toBe('no-store');
});

it('serves worker evidence when metadata times out or fails', async () => {
  state.live = { devHoldingsPct: 0, ownershipEvidence: evidence() };
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream unavailable')));
  const { data } = await (await request()).json();
  expect(data.devBalancePct).toBe(0);
  expect(data.ownershipEvidence.status).toBe('measured');
  expect(data.organicEvidence.status).toBe('unavailable');
  expect(data.organicEvidence.reason).toContain('upstream unavailable');
});

it('never uses the first unrelated Jupiter search result', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'unrelated', audit: { mintAuthorityDisabled: true, devBalancePercentage: 0 } }] }));
  const { data } = await (await request()).json();
  expect(data.mintAuthorityDisabled).toBeNull();
  expect(data.devBalancePct).toBeNull();
  expect(data.organicEvidence.status).toBe('unavailable');
});

it('keeps old observations stale when a metadata reconciliation fails', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ id: mint, audit: { mintAuthorityDisabled: true } }] })
    .mockResolvedValue({ ok: false, status: 429 });
  vi.stubGlobal('fetch', fetcher);
  const first = (await (await request()).json()).data;
  await vi.advanceTimersByTimeAsync(60_001);
  const next = (await (await request()).json()).data;
  expect(next.mintAuthorityDisabled).toBe(true);
  expect(next.mintAuthorityEvidence.status).toBe('stale');
  expect(next.mintAuthorityEvidence.observedAt).toBe(first.mintAuthorityEvidence.observedAt);
  expect(next.mintAuthorityEvidence.reason).toContain('429');
});

it('reads worker completions after the metadata await, not before it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
    state.live = { devHoldingsPct: 7, ownershipEvidence: evidence() };
    state.pending = false;
    return { ok: true, json: async () => [] };
  }));
  state.pending = true;
  const { data } = await (await request()).json();
  expect(data.devBalancePct).toBe(7);
  expect(data.holderAuditPending).toBe(false);
});
