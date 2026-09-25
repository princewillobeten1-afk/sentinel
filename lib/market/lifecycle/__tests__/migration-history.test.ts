import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MigrationHistory } from '../migration-history';
import { PUMPFUN_MIGRATION_AUTHORITY } from '../migration-detector';
import { fetchConfirmedSignatures, fetchMigrationWithFailover } from '../migration-rpc';

vi.mock('../migration-detector', () => ({
  PUMPFUN_MIGRATION_AUTHORITY: 'migration-authority',
}));
vi.mock('../migration-rpc', () => ({
  fetchConfirmedSignatures: vi.fn(), fetchMigrationWithFailover: vi.fn(),
}));
const now = Date.now();
const row = (signature: string, blockTime = now / 1000) => ({ signature, blockTime, err: null });
const proof = (signature: string) => ({ signature, mint: 'confirmed-mint', poolAddress: 'confirmed-pool', dex: 'PumpSwap', migratedAt: now });
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  vi.mocked(fetchConfirmedSignatures).mockResolvedValue([row('confirmed')]);
  vi.mocked(fetchMigrationWithFailover).mockResolvedValue(proof('confirmed'));
});
afterEach(() => { vi.useRealTimers(); });

describe('migration restart/reconnect recovery', () => {
  it('uses the migration authority, not the last few swaps on a busy pool', async () => {
    const publish = vi.fn();
    await new MigrationHistory().reconcile('http://rpc.test', publish);
    expect(fetchConfirmedSignatures).toHaveBeenCalledWith('http://rpc.test', PUMPFUN_MIGRATION_AUTHORITY, 100);
    expect(publish).toHaveBeenCalledWith(proof('confirmed'));
  });
  it('rejects failed, old and unconfirmed transactions', async () => {
    vi.mocked(fetchConfirmedSignatures).mockResolvedValue([
      { ...row('failed'), err: { failed: true } }, row('old', now / 1000 - 3 * 3600), row('not-a-migration'),
    ]);
    vi.mocked(fetchMigrationWithFailover).mockResolvedValue(null);
    const publish = vi.fn();
    await new MigrationHistory().reconcile('http://rpc.test', publish);
    expect(fetchMigrationWithFailover).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });
  it('does not resolve already recovered signatures again', async () => {
    const history = new MigrationHistory();
    await history.reconcile('http://rpc.test', vi.fn());
    await history.reconcile('http://rpc.test', vi.fn());
    expect(fetchMigrationWithFailover).toHaveBeenCalledTimes(1);
  });
  it('caps transaction decoding and retries unresolved events later', async () => {
    vi.mocked(fetchConfirmedSignatures).mockResolvedValue(Array.from({ length: 20 }, (_, i) => row(`sig-${i}`)));
    vi.mocked(fetchMigrationWithFailover).mockResolvedValue(null);
    const history = new MigrationHistory();
    await history.reconcile('http://rpc.test', vi.fn());
    expect(fetchMigrationWithFailover).toHaveBeenCalledTimes(8);
    vi.setSystemTime(now + 61_000);
    await history.reconcile('http://rpc.test', vi.fn());
    expect(fetchMigrationWithFailover).toHaveBeenCalledTimes(16);
  });
  it('never emits a migration for a failed or malformed provider response', async () => {
    const publish = vi.fn();
    vi.mocked(fetchConfirmedSignatures).mockResolvedValue(null);
    await new MigrationHistory().reconcile('http://rpc.test', publish);
    vi.mocked(fetchConfirmedSignatures).mockResolvedValue(null);
    await new MigrationHistory().reconcile('http://rpc.test', publish);
    expect(publish).not.toHaveBeenCalled();
  });
});
