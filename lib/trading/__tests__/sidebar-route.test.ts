import { beforeEach, describe, expect, it, vi } from 'vitest';
const providers = vi.hoisted(() => ({ tokens: vi.fn(), paid: vi.fn(), patch: vi.fn(), audit: vi.fn(), security: vi.fn(), lock: vi.fn(), extras: vi.fn() }));
vi.mock('@/lib/discovery/jupiter-feed', () => ({ fetchJupiterTokensByMint: providers.tokens, mapJupiterToken: (token: {id: string}) => ({ mint: token.id, priceUsd: '1' }) }));
vi.mock('@/lib/discovery/dexscreener-orders', () => ({ fetchDexPaidStatus: providers.paid }));
vi.mock('@/lib/market/live/card-cache', () => ({ getTokenCardPatch: providers.patch, hydrateTokenCards: vi.fn() }));
vi.mock('@/lib/market/enrichment/audit-worker', () => ({ queueAudit: providers.audit }));
vi.mock('@/lib/market/enrichment/security-worker', () => ({ queueSecurityTarget: providers.security }));
vi.mock('@/lib/trading/rugcheck-liquidity', () => ({ getLiquidityLock: providers.lock }));
vi.mock('@/lib/trading/sidebar-enrichment', () => ({ queueSidebarEnrichment: providers.extras }));
import { GET } from '@/app/api/v1/tokens/[chain]/[address]/card/route';
const mints = ['So11111111111111111111111111111111111111112', '11111111111111111111111111111111', 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'];
const get = (address: string, chain = 'solana') => GET(new Request('http://localhost'), { params: { chain, address } });
beforeEach(() => { vi.clearAllMocks(); providers.tokens.mockResolvedValue([]); providers.paid.mockResolvedValue(null); providers.lock.mockResolvedValue({ lpLockedPct: null, evidence: {status:'unavailable',source:'fixture',observedAt:'2026-01-01',reason:'No pool'} }); providers.extras.mockReturnValue({}); providers.patch.mockReturnValue(null); });
describe('trade sidebar snapshot endpoint', () => {
  it('rejects invalid mints and unsupported chains before provider calls', async () => {
    expect((await get('invalid')).status).toBe(400);
    expect((await get(mints[0], 'ethereum')).status).toBe(400);
    expect(providers.tokens).not.toHaveBeenCalled();
    expect(providers.audit).not.toHaveBeenCalled();
  });
  it('keeps missing data unknown, including paid status and LP lock', async () => {
    providers.tokens.mockResolvedValue([{ id: mints[1], stats5m: { buyVolume: 900 } }]);
    const body = await (await get(mints[0])).json();
    expect(body.data.token).toMatchObject({ mint: mints[0], buyVolume5mUsd: null, sellVolume5mUsd: null, lpLockedPct: null });
  });
  it('retains measured zero and combines provider-backed cached ownership', async () => {
    providers.tokens.mockResolvedValue([{ id: mints[2], stats5m: { buyVolume: 0, sellVolume: 12 } }]);
    providers.paid.mockResolvedValue({ isDexPaid: false });
    providers.patch.mockReturnValue({ mint: mints[2], sequence: 1, source: 'fixture', observedAt: new Date().toISOString(), freshness: 'fresh', changedFields: { devHoldingsPct: 0 } });
    const body = await (await get(mints[2])).json();
    expect(body.data.token).toMatchObject({ buyVolume5mUsd: 0, sellVolume5mUsd: 12, isDexPaid: false, devHoldingsPct: 0, lpLockedPct: null });
  });
});
