import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBitqueryActivity, applyBitqueryActivity } from '../bitquery-activity';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock('../live/card-cache', () => ({
  getTokenCardPatch: mocks.get, updateTokenCard: mocks.update,
}));
const mint = '4NLjoZAt6Sd47oTs2hb2JRA7qiJzHmWQfDeNvtJPpump';
const row = { Trade: { Currency: { MintAddress: mint } }, buys5: '2', sells5: '1',
  buys1: '8', sells1: '5', buys24: '12', sells24: '9',
  volume5: '20.5', volume1: '100.5', volume24: '500.5',
  buyVolume5: '15', sellVolume5: '5.5' };

describe('Bitquery visible-card trade fallback', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.get.mockReturnValue(undefined); });

  it('parses measured window counts and USD volumes without inventing absent rows', () => {
    expect(parseBitqueryActivity({ data: { Solana: { DEXTradeByTokens: [row] } } }, [mint]))
      .toMatchObject([{ mint, buys5: 2, sells24: 9, volume5: 20.5 }]);
    expect(parseBitqueryActivity({ data: { Solana: { DEXTradeByTokens: [] } } }, [mint])).toEqual([]);
    expect(parseBitqueryActivity({ errors: [{ message: 'quota' }] }, [mint])).toBeNull();
    expect(parseBitqueryActivity({ data: { Solana: { DEXTradeByTokens: [{ ...row, buys5: 'n/a' }] } } }, [mint])).toBeNull();
  });

  it('fills missing fields without replacing a newer Birdeye market value', () => {
    mocks.get.mockReturnValue({ fieldSources: { volume1hUsd: 'birdeye-token-stats' }, changedFields: {
      volume1hUsd: '900', marketEvidence: { status: 'measured', source: 'birdeye-token-stats', observedAt: '2026-09-25T10:00:00Z' },
    } });
    const parsed = parseBitqueryActivity({ data: { Solana: { DEXTradeByTokens: [row] } } }, [mint])!;
    applyBitqueryActivity(parsed, '2026-09-25T10:01:00Z');
    expect(mocks.update).toHaveBeenCalledWith(mint,
      expect.objectContaining({ volume5mUsd: '20.5', txCount5m: 3,
        activityEvidence: expect.objectContaining({ source: 'bitquery-dex-activity' }) }),
      'bitquery-dex-activity', 'fresh', '2026-09-25T10:01:00Z');
    expect(mocks.update.mock.calls[0][1].volume1hUsd).toBeUndefined();
    expect(mocks.update.mock.calls[0][1].marketEvidence?.source).toBe('birdeye-token-stats+bitquery-dex-activity');
  });

  it('refreshes its own fields without replacing Birdeye-owned fields in a mixed card', () => {
    mocks.get.mockReturnValue({ fieldSources: { volume5mUsd: 'bitquery-dex-activity', buysCount5m: 'birdeye-token-stats' },
      changedFields: { volume5mUsd: '1', buysCount5m: 7,
        activityEvidence: { status: 'measured', source: 'birdeye-token-stats+bitquery-dex-activity', observedAt: '2026-09-25T10:00:00Z' } } });
    applyBitqueryActivity(parseBitqueryActivity({ data: { Solana: { DEXTradeByTokens: [row] } } }, [mint])!, '2026-09-25T10:01:00Z');
    expect(mocks.update.mock.calls[0][1].volume5mUsd).toBe('20.5');
    expect(mocks.update.mock.calls[0][1].buysCount5m).toBeUndefined();
    expect(mocks.update.mock.calls[0][1].activityEvidence?.source).toBe('birdeye-token-stats+bitquery-dex-activity');
  });

  it('upgrades a tertiary DexScreener measurement when Bitquery becomes available', () => {
    mocks.get.mockReturnValue({ fieldSources: { txCount5m: 'dexscreener-batch-rest' },
      changedFields: { txCount5m: 1, activityEvidence: { status: 'measured', source: 'dexscreener-batch-rest', observedAt: '2026-09-25T10:00:00Z' } } });
    applyBitqueryActivity(parseBitqueryActivity({ data: { Solana: { DEXTradeByTokens: [row] } } }, [mint])!, '2026-09-25T10:01:00Z');
    expect(mocks.update.mock.calls[0][1].txCount5m).toBe(3);
    expect(mocks.update.mock.calls[0][1].activityEvidence.source).toBe('dexscreener-batch-rest+bitquery-dex-activity');
  });
});
