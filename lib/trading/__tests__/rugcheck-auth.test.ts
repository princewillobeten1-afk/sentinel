import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rugcheckHeaders } from '../rugcheck-headers';
import { fetchRugcheckOwnership, parseRugcheckOwnership } from '../rugcheck-ownership';
import { getLiquidityLock, resetLiquidityLockCache } from '../rugcheck-liquidity';
import { resetProviderCooldowns } from '../provider-read';
import { readRugcheckReport, resetRugcheckAccessForTests, rugcheckAccessHealth } from '../rugcheck-report';

const mint = 'So11111111111111111111111111111111111111112';
const report = {
  mint, totalHolders: 12, topHolders: [{ owner: 'creator', pct: 10 }], creator: 'creator',
  markets: [{ lp: { lpLockedPct: 100, baseUSD: 100, quoteUSD: 100 } }],
};

beforeEach(() => {
  vi.stubEnv('RUGCHECK_API_ENDPOINT', ''); vi.stubEnv('RUGCHECK_SHIELD_KEY', '');
  resetLiquidityLockCache(); resetProviderCooldowns(); resetRugcheckAccessForTests();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('optional Rugcheck API key', () => {
  it.each([undefined, '', '   '])('omits authentication for a missing or blank key (%s)', (key) => {
    vi.stubEnv('RUGCHECK_API_KEY', key);
    expect(rugcheckHeaders()).toEqual({ Accept: 'application/json' });
  });

  it('reads the current server key at request time and trims whitespace', () => {
    vi.stubEnv('RUGCHECK_API_KEY', '  local-test-key  ');
    expect(rugcheckHeaders()['X-API-KEY']).toBe('local-test-key');
    vi.stubEnv('RUGCHECK_API_KEY', 'rotated-test-key');
    expect(rugcheckHeaders()['X-API-KEY']).toBe('rotated-test-key');
  });

  it.each(['local-test-key', ''])('applies the same optional authentication to both report consumers', async (key) => {
    vi.stubEnv('RUGCHECK_API_KEY', key);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal('fetch', fetcher);
    const ownership = await fetchRugcheckOwnership(mint);
    const liquidity = await getLiquidityLock(mint);
    expect(ownership).toMatchObject({ top10Pct: 10, devPct: 10, totalHolders: 12 });
    expect(liquidity.lpLockedPct).toBe(100);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`);
      expect(init.headers).toEqual({ Accept: 'application/json', ...(key ? { 'X-API-KEY': key } : {}) });
      expect(init.cache).toBe('no-store');
    }
    expect(JSON.stringify({ ownership, liquidity })).not.toContain('local-test-key');
  });

  it('never exposes a rejected key echoed in a provider error body', async () => {
    vi.stubEnv('RUGCHECK_API_KEY', 'rejected-test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, headers: new Headers(),
      json: async () => ({ error: 'Rejected rejected-test-key' }),
    }));
    const ownership = await fetchRugcheckOwnership(mint);
    const liquidity = await getLiquidityLock(mint);
    expect(ownership).toBeNull();
    expect(liquidity.evidence).toMatchObject({ status: 'unavailable', reason: 'Rugcheck public is cooling down after a quota or access error.' });
    expect(JSON.stringify(liquidity)).not.toContain('rejected-test-key');
  });

  it.each([401, 403])('retains public reports after HTTP %s and pauses rejected authentication', async (status) => {
    vi.stubEnv('RUGCHECK_API_KEY', 'rpc-key-not-report-key');
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status, headers: new Headers(), json: async () => ({ error: 'Rejected' }) })
      .mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal('fetch', fetcher);
    expect(await readRugcheckReport(mint)).toEqual(report);
    expect(await readRugcheckReport(mint)).toEqual(report);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][1].headers['X-API-KEY']).toBe('rpc-key-not-report-key');
    expect(fetcher.mock.calls[1][1].headers).toEqual({ Accept: 'application/json' });
    expect(fetcher.mock.calls[2][1].headers).toEqual({ Accept: 'application/json' });
    expect(rugcheckAccessHealth()).toMatchObject({ authenticatedAccess: 'rejected', lastMode: 'public', lastAuthStatus: status });
    expect(JSON.stringify(rugcheckAccessHealth())).not.toContain('rpc-key-not-report-key');
  });

  it('retries authentication immediately after the report key is rotated', async () => {
    vi.stubEnv('RUGCHECK_API_KEY', 'old-key');
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers(), json: async () => ({ error: 'Rejected' }) })
      .mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal('fetch', fetcher);
    await readRugcheckReport(mint);
    vi.stubEnv('RUGCHECK_API_KEY', 'new-key');
    await readRugcheckReport(mint);
    expect(fetcher.mock.calls[2][1].headers['X-API-KEY']).toBe('new-key');
    expect(rugcheckAccessHealth()).toMatchObject({ authenticatedAccess: 'verified', lastMode: 'authenticated', retryAfter: null });
  });

  it('does not switch to Shield or public reports to bypass account quotas', async () => {
    const status = 429;
    vi.stubEnv('RUGCHECK_API_KEY', 'report-key');
    vi.stubEnv('RUGCHECK_SHIELD_KEY', 'shield-key');
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status, headers: new Headers({ 'retry-after': '120' }), json: async () => ({ error: 'Unavailable' }) });
    vi.stubGlobal('fetch', fetcher);
    await expect(readRugcheckReport(mint)).rejects.toThrow(`HTTP ${status}`);
    await expect(readRugcheckReport(mint)).rejects.toThrow('cooling down');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(rugcheckAccessHealth().lastMode).toBeNull();
  });

  it('honors the API endpoint but moves its query key into a private header', async () => {
    vi.stubEnv('RUGCHECK_API_KEY', '');
    vi.stubEnv('RUGCHECK_API_ENDPOINT', 'https://api.rugcheck.xyz/?key=endpoint-key');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal('fetch', fetcher);
    await readRugcheckReport(mint);
    expect(fetcher.mock.calls[0][0]).toBe(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`);
    expect(fetcher.mock.calls[0][1].headers['X-API-KEY']).toBe('endpoint-key');
    expect(fetcher.mock.calls[0][1].redirect).toBe('error');
    vi.stubEnv('RUGCHECK_API_KEY', 'explicit-key');
    expect(rugcheckHeaders()['X-API-KEY']).toBe('explicit-key');
  });

  it.each(['shield-key', 'https://shield.rugcheck.xyz/?key=shield-key'])('uses the configured Shield report fallback without forwarding the private API key (%s)', async (shield) => {
    vi.stubEnv('RUGCHECK_API_KEY', 'private-key');
    vi.stubEnv('RUGCHECK_SHIELD_KEY', shield);
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers(), json: async () => ({ error: 'Temporarily unavailable' }) })
      .mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal('fetch', fetcher);
    expect(await readRugcheckReport(mint)).toEqual(report);
    expect(fetcher.mock.calls[1][0]).toBe(`https://shield.rugcheck.xyz/v1/tokens/${mint}/report?key=shield-key`);
    expect(fetcher.mock.calls[1][1].headers).toEqual({ Accept: 'application/json' });
    expect(rugcheckAccessHealth()).toMatchObject({ lastMode: 'shield', shield: 'verified' });
    expect(JSON.stringify(rugcheckAccessHealth())).not.toMatch(/private-key|shield-key/);
    await readRugcheckReport(mint);
    expect(fetcher).toHaveBeenCalledTimes(3); // primary remains in its cooldown
    expect(new URL(fetcher.mock.calls[2][0]).hostname).toBe('shield.rugcheck.xyz');
  });

  it('does not call Shield when the primary report succeeds', async () => {
    vi.stubEnv('RUGCHECK_API_KEY', 'private-key'); vi.stubEnv('RUGCHECK_SHIELD_KEY', 'shield-key');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal('fetch', fetcher);
    await readRugcheckReport(mint);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new URL(fetcher.mock.calls[0][0]).hostname).toBe('api.rugcheck.xyz');
  });

  it('shares one in-flight report between ownership and LP lock consumers', async () => {
    vi.stubEnv('RUGCHECK_API_KEY', 'report-key');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal('fetch', fetcher);
    const [ownership, liquidity] = await Promise.all([fetchRugcheckOwnership(mint), getLiquidityLock(mint)]);
    expect(ownership?.top10Pct).toBe(10);
    expect(liquidity.lpLockedPct).toBe(100);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(['https://attacker.example/?key=secret', 'http://api.rugcheck.xyz/?key=secret', 'https://api.rugcheck.xyz@attacker.example'])('refuses unsafe endpoint configuration (%s)', async (endpoint) => {
    vi.stubEnv('RUGCHECK_API_ENDPOINT', endpoint); vi.stubEnv('RUGCHECK_API_KEY', 'secret');
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(readRugcheckReport(mint)).rejects.toThrow('Rugcheck endpoint configuration is invalid.');
    expect(fetcher).not.toHaveBeenCalled();
    expect(rugcheckAccessHealth().authenticatedAccess).toBe('invalid-config');
  });

  it('does not accept a report for a different mint', async () => {
    vi.stubEnv('RUGCHECK_API_KEY', 'report-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...report, mint: 'other-token' }) }));
    expect(await fetchRugcheckOwnership(mint)).toBeNull();
    expect((await getLiquidityLock(mint)).lpLockedPct).toBeNull();
    expect(rugcheckAccessHealth().lastMode).toBeNull();
  });

  it('does not treat an unpopulated cached holder report as a measured zero', () => {
    expect(parseRugcheckOwnership(mint, { mint, totalHolders: 0, topHolders: [] })).toBeNull();
  });

  it('paces distinct report requests at the documented free-tier rate', async () => {
    vi.useFakeTimers();
    vi.stubEnv('RUGCHECK_API_KEY', 'report-key');
    const requestedAt: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requestedAt.push(Date.now());
      const requestedMint = url.split('/').at(-2);
      return { ok: true, json: async () => ({ ...report, mint: requestedMint }) };
    }));
    const otherMint = '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN';
    const first = readRugcheckReport(mint);
    const second = readRugcheckReport(otherMint);
    await vi.advanceTimersByTimeAsync(1_001);
    await Promise.all([first, second]);
    expect(requestedAt).toHaveLength(2);
    expect(requestedAt[1] - requestedAt[0]).toBeGreaterThanOrEqual(1_000);
  });
});
