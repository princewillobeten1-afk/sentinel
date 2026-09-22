import { describe, it, expect, beforeEach, vi } from 'vitest';

// Never touch the network: this is about which mints are queued, not what
// comes back. Left pending so the queue can be observed mid-drain.
vi.mock('../holder-profile', () => ({
  fetchHolderProfileResult: vi.fn(() => new Promise(() => {})),
}));
vi.mock('@/lib/server/redis', () => ({ redis: { claim: vi.fn().mockResolvedValue(true) } }));
vi.mock('@/lib/market/live/card-cache', () => ({ getTokenCardPatch: vi.fn(), updateTokenCard: vi.fn() }));
vi.mock('@/lib/server/db/token-card-evidence-repository', () => ({ saveTokenCardEvidence: vi.fn() }));

const load = async () => {
  vi.resetModules();
  const mod = await import('../audit-worker');
  mod.__resetAudit();
  return mod;
};

describe('audit targets follow the screen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drops mints that rotated off screen', async () => {
    const { setAuditTargets, auditStats, isAuditPending } = await load();

    setAuditTargets('new', ['a', 'b', 'c']);
    expect(isAuditPending('b')).toBe(true);

    // New Pairs rotates: b and c are gone, d and e arrived. This is the case
    // that starved the queue — appending meant the budget was spent on tokens
    // nobody could see any more.
    setAuditTargets('new', ['a', 'd', 'e']);

    expect(isAuditPending('b')).toBe(false);
    expect(isAuditPending('c')).toBe(false);
    expect(isAuditPending('d')).toBe(true);
    expect(auditStats().queued).toBe(3);
  });

  it('keeps sections from overwriting each other', async () => {
    const { setAuditTargets, isAuditPending, auditStats } = await load();

    setAuditTargets('new', ['n1', 'n2']);
    setAuditTargets('graduated', ['g1']);

    // Five sections declare targets independently; a shared replace would have
    // the last writer erase the rest.
    expect(isAuditPending('n1')).toBe(true);
    expect(isAuditPending('g1')).toBe(true);
    expect(auditStats().sections).toBe(2);
  });

  it('does not re-queue a mint that is already cached', async () => {
    const { setAuditTargets, auditStats } = await load();

    setAuditTargets('new', ['x', 'x', 'x']);
    // De-duplicated, so one slot rather than three.
    expect(auditStats().queued).toBe(1);
  });

  it('preserves declaration order so the top of a column resolves first', async () => {
    const { setAuditTargets, auditStats } = await load();

    setAuditTargets('new', ['first', 'second', 'third']);
    // One is in flight; the rest wait in order.
    expect(auditStats().queued).toBe(3);
    expect(auditStats().pending).toBeLessThanOrEqual(3);
  });

  it('clears a section by declaring it empty', async () => {
    const { setAuditTargets, isAuditPending } = await load();

    setAuditTargets('new', ['a', 'b']);
    setAuditTargets('new', []);

    expect(isAuditPending('a')).toBe(false);
    expect(isAuditPending('b')).toBe(false);
  });

  it('refreshes a stale detail audit before the ten-minute retention cache expires', async () => {
    const { queueAudit, isAuditPending } = await load();
    const globalCache = (globalThis as unknown as { sentinelAuditCache: Map<string, unknown> }).sentinelAuditCache;
    globalCache.set('old', { mint: 'old', fetchedAt: Date.now() - 61_000 });
    globalCache.set('fresh', { mint: 'fresh', fetchedAt: Date.now() });
    queueAudit(['old', 'fresh']);
    expect(isAuditPending('old')).toBe(true);
    expect(isAuditPending('fresh')).toBe(false);
  });

  it('keeps a waiting detail audit when a Discover section replaces its targets', async () => {
    const { queueAudit, setAuditTargets, isAuditPending } = await load();
    queueAudit(['active-detail', 'waiting-detail']);
    setAuditTargets('visible', ['card']);
    expect(isAuditPending('waiting-detail')).toBe(true);
    expect(isAuditPending('card')).toBe(true);
  });
});
