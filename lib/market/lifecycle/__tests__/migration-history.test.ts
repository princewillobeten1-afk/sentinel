import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MigrationHistory } from '../migration-history';
import { fetchMigration, PUMPFUN_MIGRATION_AUTHORITY } from '../migration-detector';

vi.mock('../migration-detector', () => ({
  PUMPFUN_MIGRATION_AUTHORITY: 'migration-authority', fetchMigration: vi.fn(),
}));
const now = Date.now();
const row = (signature: string, blockTime = now / 1000) => ({ signature, blockTime, err: null });
const proof = (signature: string) => ({ signature, mint: 'confirmed-mint', poolAddress: 'confirmed-pool', dex: 'PumpSwap', migratedAt: now });
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now); vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: [row('confirmed')] }) });
  vi.mocked(fetchMigration).mockResolvedValue(proof('confirmed'));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('migration restart/reconnect recovery', () => {
  it('uses the migration authority, not the last few swaps on a busy pool', async () => {
    const publish = vi.fn();
    await new MigrationHistory().reconcile('http://rpc.test', publish);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.params[0]).toBe(PUMPFUN_MIGRATION_AUTHORITY);
    expect(publish).toHaveBeenCalledWith(proof('confirmed'));
  });
  it('rejects failed, old and unconfirmed transactions', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: [
      { ...row('failed'), err: { failed: true } }, row('old', now / 1000 - 3 * 3600), row('not-a-migration'),
    ] }) });
    vi.mocked(fetchMigration).mockResolvedValue(null);
    const publish = vi.fn();
    await new MigrationHistory().reconcile('http://rpc.test', publish);
    expect(fetchMigration).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });
  it('does not resolve already recovered signatures again', async () => {
    const history = new MigrationHistory();
    await history.reconcile('http://rpc.test', vi.fn());
    await history.reconcile('http://rpc.test', vi.fn());
    expect(fetchMigration).toHaveBeenCalledTimes(1);
  });
  it('caps transaction decoding and retries unresolved events later', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: Array.from({ length: 20 }, (_, i) => row(`sig-${i}`)) }) });
    vi.mocked(fetchMigration).mockResolvedValue(null);
    const history = new MigrationHistory();
    await history.reconcile('http://rpc.test', vi.fn());
    expect(fetchMigration).toHaveBeenCalledTimes(8);
    vi.setSystemTime(now + 61_000);
    await history.reconcile('http://rpc.test', vi.fn());
    expect(fetchMigration).toHaveBeenCalledTimes(16);
  });
  it('never emits a migration for a failed or malformed provider response', async () => {
    const publish = vi.fn();
    fetchMock.mockResolvedValue({ ok: false });
    await new MigrationHistory().reconcile('http://rpc.test', publish);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: {} }) });
    await new MigrationHistory().reconcile('http://rpc.test', publish);
    expect(publish).not.toHaveBeenCalled();
  });
});
