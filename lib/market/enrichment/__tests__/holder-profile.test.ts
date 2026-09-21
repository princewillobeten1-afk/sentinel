import { describe, it, expect } from 'vitest';
import { parseHolderProfile } from '../holder-profile';

const MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

/** The live response shape, trimmed to the fields that are read. */
const body = {
  data: {
    token: { top10_holder: { hold_amount: '33618240531978.625', percent_of_supply: 38.20492 } },
    holder_summary: { total_holder: 1010481, total_holding: 87994535010202.94 },
    tags: [
      { tag: 'bundler', holder_count: 3191, percent_of_supply: 0.34245 },
      { tag: 'sniper', holder_count: 1, percent_of_supply: 0 },
      { tag: 'insider', holder_count: 72295, percent_of_supply: 6.01222 },
      { tag: 'dev', holder_count: 1, percent_of_supply: 0 },
      { tag: 'smart_trader', holder_count: 1207, percent_of_supply: 0.03295 },
      { tag: 'kol', holder_count: 467, percent_of_supply: 0.00266 },
    ],
  },
};

describe('parseHolderProfile', () => {
  it.each([undefined, null, {}, [null], [{ tag: 'sniper' }, null]])('does not fabricate zero classifications from malformed tags: %j', (tags) => {
    const profile = parseHolderProfile(MINT, { data: { tags } });
    expect(profile?.snipersPct).toBeNull();
    expect(profile?.proTraders).toBeNull();
  });

  it('keeps missing or invalid fields in a present tag unknown', () => {
    const profile = parseHolderProfile(MINT, { data: {
      tags: [{ tag: 'sniper', percent_of_supply: '' }, { tag: 'smart_trader', holder_count: -2 }],
      token: { top10_holder: { percent_of_supply: 101 } },
    } });
    expect(profile?.snipersPct).toBeNull();
    expect(profile?.proTraders).toBeNull();
    expect(profile?.top10Pct).toBeNull();
  });

  it('rejects a failed envelope even when it contains data', () => {
    expect(parseHolderProfile(MINT, { ...body, success: false })).toBeNull();
  });
  it('reads every field the card used to fake', () => {
    const profile = parseHolderProfile(MINT, body);
    expect(profile).not.toBeNull();
    if (!profile) return;

    // Each of these shipped as a hardcoded constant on every token.
    expect(profile.top10Pct).toBeCloseTo(38.20492);
    expect(profile.snipersPct).toBe(0);
    expect(profile.insidersPct).toBeCloseTo(6.01222);
    expect(profile.bundlersPct).toBeCloseTo(0.34245);
    // And these were `holdersCount * 0.12` and `* 0.04`.
    expect(profile.proTraders).toBe(1207);
    expect(profile.kols).toBe(467);
    // The real total, not the top-20 cap an RPC scan sees.
    expect(profile.totalHolders).toBe(1010481);
  });

  it('treats an absent tag as a measured zero', () => {
    // Birdeye omits a class when it found no wallets in it. That is a real
    // zero, unlike a failed request — which returns null from the fetcher and
    // never reaches this parser.
    const profile = parseHolderProfile(MINT, {
      data: { token: {}, holder_summary: {}, tags: [{ tag: 'insider', holder_count: 5, percent_of_supply: 2 }] },
    });

    expect(profile?.snipersPct).toBe(0);
    expect(profile?.bundlersPct).toBe(0);
    expect(profile?.insidersPct).toBe(2);
  });

  it('leaves top10 and holder count null when not reported', () => {
    // These have no sensible zero: "no top-10 concentration" is not a thing.
    const profile = parseHolderProfile(MINT, { data: { token: {}, holder_summary: {}, tags: [] } });
    expect(profile?.top10Pct).toBeNull();
    expect(profile?.totalHolders).toBeNull();
  });

  it('parses numeric fields that arrive as strings', () => {
    const profile = parseHolderProfile(MINT, {
      data: {
        token: { top10_holder: { percent_of_supply: '41.5' } },
        holder_summary: { total_holder: '900' },
        tags: [{ tag: 'sniper', holder_count: '7', percent_of_supply: '1.25' }],
      },
    });

    expect(profile?.top10Pct).toBe(41.5);
    expect(profile?.totalHolders).toBe(900);
    expect(profile?.snipersPct).toBe(1.25);
  });

  it('returns null for a body with no data envelope', () => {
    expect(parseHolderProfile(MINT, {})).toBeNull();
    expect(parseHolderProfile(MINT, null)).toBeNull();
    expect(parseHolderProfile(MINT, { success: false, message: 'Too many requests' })).toBeNull();
  });
});

describe('quota exhaustion is its own outcome', () => {
  it('is reported as a 400 with a compute-unit message, not 402 or 429', async () => {
    // The shape that stalled the audit: Birdeye answers HTTP 400, so without
    // reading the body it is indistinguishable from a malformed request and the
    // worker grinds through its whole queue re-failing on every mint.
    const { fetchHolderProfileResult } = await import('../holder-profile');
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('{"success":false,"message":"Compute units usage limit exceeded"}', {
        status: 400,
      })) as typeof fetch;
    process.env.BIRDEYE_API_KEY = 'test-key';

    try {
      const result = await fetchHolderProfileResult('SomeMint1111111111111111111111111111111111');
      expect(result.kind).toBe('quota-exhausted');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('still reports an ordinary 400 as a plain failure', async () => {
    const { fetchHolderProfileResult } = await import('../holder-profile');
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('{"success":false,"message":"token_address is required"}', {
        status: 400,
      })) as typeof fetch;
    process.env.BIRDEYE_API_KEY = 'test-key';

    try {
      const result = await fetchHolderProfileResult('SomeMint1111111111111111111111111111111111');
      expect(result.kind).toBe('failed');
    } finally {
      globalThis.fetch = original;
    }
  });
});
