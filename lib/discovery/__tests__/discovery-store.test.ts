import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOnce } from '@/lib/api/fetch-once';
import {
  __resetDiscoveryStore, getSection, refreshDiscovery,
  setDiscoveryQuery, subscribeToDiscovery,
} from '../discovery-store';

vi.mock('@/lib/api/fetch-once', () => ({ fetchOnce: vi.fn() }));

beforeEach(() => {
  __resetDiscoveryStore();
  vi.mocked(fetchOnce).mockReset();
});
afterEach(() => __resetDiscoveryStore());

describe('visible discovery feed demand', () => {
  it('polls mounted columns without requesting every hidden discovery section', async () => {
    vi.mocked(fetchOnce).mockResolvedValue({ data: { tokens: [] } });
    const stopNew = subscribeToDiscovery(() => undefined, 'new');
    await vi.waitFor(() => expect(fetchOnce).toHaveBeenCalled());
    expect(vi.mocked(fetchOnce).mock.calls.every(([url]) => String(url).includes('/discovery/new?'))).toBe(true);

    const stopMigrating = subscribeToDiscovery(() => undefined, 'migrating');
    await vi.waitFor(() => expect(getSection('migrating').state).toBe('live'));
    stopNew();
    vi.mocked(fetchOnce).mockClear();
    refreshDiscovery();
    await vi.waitFor(() => expect(fetchOnce).toHaveBeenCalled());
    expect(vi.mocked(fetchOnce).mock.calls.every(([url]) => String(url).includes('/discovery/migrating?'))).toBe(true);
    stopMigrating();
  });

  it('does not publish an obsolete query response after the selected chain changes', async () => {
    let resolveFirst!: (value: unknown) => void;
    vi.mocked(fetchOnce)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }) as ReturnType<typeof fetchOnce>)
      .mockResolvedValue({ data: { tokens: [{ mint: 'new-chain' }] } });
    const stop = subscribeToDiscovery(() => undefined, 'new');
    await vi.waitFor(() => expect(fetchOnce).toHaveBeenCalledTimes(1));
    setDiscoveryQuery({ chain: 'ethereum' });
    resolveFirst({ data: { tokens: [{ mint: 'old-chain' }] } });
    await vi.waitFor(() => expect(getSection('new').tokens[0]?.mint).toBe('new-chain'));
    expect(vi.mocked(fetchOnce).mock.calls[1][0]).toContain('chain=ethereum');
    stop();
  });
});
