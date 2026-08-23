import { describe, it, expect } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

/**
 * Unit tests for `db/backfill-token-enrichment.js`.
 *
 * The backfill is plain CommonJS outside Next's TS pipeline (same as
 * `db/migrate.js`), so it is loaded here with `createRequire` rather than
 * imported. The script only runs `main()` under `require.main === module`, so
 * requiring it is side-effect free — no Postgres connection, no network.
 *
 * These tests carry more weight than usual: the Birdeye quota is exhausted, so
 * the enrichment path cannot be exercised end-to-end against the live API.
 * Everything below is the logic that decides whether a number reaches the
 * database, and it has to be right before the quota resets — not after it has
 * written 930 wrong rows.
 */

const require_ = createRequire(import.meta.url);
const backfill = require_(path.resolve(__dirname, '../../../../db/backfill-token-enrichment.js'));
const { isQuotaMessage, isValidSolanaMint, mergeEnrichment, num, parseArgs, registryIdForMint } =
  backfill;

describe('isQuotaMessage', () => {
  it('recognises the exact message Birdeye returns when units run out', () => {
    // Verbatim from a live probe of /defi/token_trending.
    expect(isQuotaMessage('Compute units usage limit exceeded')).toBe(true);
  });

  it('recognises the other rate/quota phrasings', () => {
    expect(isQuotaMessage('Too many requests, rate limit reached')).toBe(true);
    expect(isQuotaMessage('API quota exceeded for this plan')).toBe(true);
  });

  it('does not treat ordinary failures as quota exhaustion', () => {
    // A genuine error must stay retryable. Misreading it as quota exhaustion
    // would abort the whole run on one bad batch.
    expect(isQuotaMessage('address is invalid')).toBe(false);
    expect(isQuotaMessage('Internal server error')).toBe(false);
    expect(isQuotaMessage(undefined)).toBe(false);
    expect(isQuotaMessage(null)).toBe(false);
  });
});

describe('num', () => {
  it('keeps finite numbers, including a true zero', () => {
    expect(num(0)).toBe(0);
    expect(num(150.02)).toBe(150.02);
    expect(num('8.65')).toBe(8.65);
  });

  it('returns null for every non-measurement', () => {
    // The distinction the whole job rests on: absent is not zero.
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num('')).toBeNull();
    expect(num('n/a')).toBeNull();
    expect(num(NaN)).toBeNull();
    expect(num(Infinity)).toBeNull();
  });
});

describe('mergeEnrichment', () => {
  const priceEntry = { value: 1.25, priceChange24h: 8.65, liquidity: 42_000 };
  const volumeEntry = { price: 1.25, volumeUSD: 310_000, priceChangePercent: 8.65 };

  it('merges both batch responses into one row', () => {
    expect(mergeEnrichment(priceEntry, volumeEntry)).toEqual({
      priceUsd: 1.25,
      priceChange24h: 8.65,
      liquidityUsd: 42_000,
      volume24hUsd: 310_000,
      marketCapUsd: null,
    });
  });

  it('returns null when neither endpoint has a price', () => {
    // This is what becomes NO_MARKET — a terminal state with NULL price, never
    // a row of zeros claiming the token is worthless.
    expect(mergeEnrichment(undefined, undefined)).toBeNull();
    expect(mergeEnrichment(null, null)).toBeNull();
    expect(mergeEnrichment({ liquidity: 500 }, {})).toBeNull();
  });

  it('falls back to the volume endpoint price when multi_price has none', () => {
    const merged = mergeEnrichment(undefined, volumeEntry);
    expect(merged.priceUsd).toBe(1.25);
    expect(merged.volume24hUsd).toBe(310_000);
  });

  it('falls back to priceChangePercent when priceChange24h is absent', () => {
    const merged = mergeEnrichment({ value: 1.25 }, { priceChangePercent: -12.4 });
    expect(merged.priceChange24h).toBe(-12.4);
  });

  it('keeps a genuinely zero price change distinct from an unknown one', () => {
    // A token that did not move is 0, and must not be overwritten by the
    // fallback. `??` rather than `||` is what makes this hold.
    const flat = mergeEnrichment({ value: 1.25, priceChange24h: 0 }, { priceChangePercent: 99 });
    expect(flat.priceChange24h).toBe(0);

    const unknown = mergeEnrichment({ value: 1.25 }, {});
    expect(unknown.priceChange24h).toBeNull();
  });

  it('leaves liquidity and volume null rather than zero when unreported', () => {
    const merged = mergeEnrichment({ value: 0.004 }, {});
    expect(merged.priceUsd).toBe(0.004);
    expect(merged.liquidityUsd).toBeNull();
    expect(merged.volume24hUsd).toBeNull();
  });

  it('never invents a market cap', () => {
    // Neither batch endpoint returns circulating supply, so market cap is not
    // derivable here. It stays null instead of being computed from a guess.
    expect(mergeEnrichment(priceEntry, volumeEntry).marketCapUsd).toBeNull();
  });

  it('keeps a sub-cent price rather than rounding it away', () => {
    // Newly launched mints — the bulk of the 930 discovered rows — routinely
    // price below a cent. Rounding here would flatten them all to zero.
    const merged = mergeEnrichment({ value: 0.000000123 }, {});
    expect(merged.priceUsd).toBe(0.000000123);
  });
});

describe('isValidSolanaMint', () => {
  it('accepts real base58 mints', () => {
    expect(isValidSolanaMint('So11111111111111111111111111111111111111112')).toBe(true);
    expect(isValidSolanaMint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
  });

  it('rejects the placeholder mints MOCK_REALTIME writes', () => {
    // The enrichment table currently holds 930 of these. Sending them to
    // Birdeye would spend real compute units to be told they do not exist.
    expect(isValidSolanaMint('MockToken17869864734275k3fre')).toBe(false);
  });

  it('rejects strings carrying base58-excluded characters', () => {
    // 0, O, I and l are omitted from base58 precisely because they are
    // ambiguous, so any of them proves the string is not an address.
    expect(isValidSolanaMint('0'.repeat(40))).toBe(false);
    expect(isValidSolanaMint('O'.repeat(40))).toBe(false);
    expect(isValidSolanaMint('I'.repeat(40))).toBe(false);
    expect(isValidSolanaMint('l'.repeat(40))).toBe(false);
  });

  it('rejects lengths outside 32–44 and non-strings', () => {
    expect(isValidSolanaMint('abc')).toBe(false);
    expect(isValidSolanaMint('a'.repeat(45))).toBe(false);
    expect(isValidSolanaMint(null)).toBe(false);
    expect(isValidSolanaMint(undefined)).toBe(false);
  });
});

describe('registryIdForMint', () => {
  it('is deterministic, so a re-run updates rather than duplicates', () => {
    const mint = 'So11111111111111111111111111111111111111112';
    expect(registryIdForMint(mint)).toBe(registryIdForMint(mint));
  });

  it('gives distinct ids to mints sharing a long prefix', () => {
    // Regression: a 16-character prefix was used as the id, so these two
    // collided on `tok_mocktoken1787351`, and the promoting UPSERT overwrote
    // one token with the other — two mints in, one registry row out.
    const a = 'MockToken17873511459355yh6e';
    const b = 'MockToken1787351165989aswa8tp';
    expect(a.slice(0, 16)).toBe(b.slice(0, 16));
    expect(registryIdForMint(a)).not.toBe(registryIdForMint(b));
  });

  it('preserves case, because base58 is case-sensitive', () => {
    // Folding case can merge two genuinely different addresses into one id.
    const upper = 'ABC1111111111111111111111111111111111111112';
    const lower = 'abc1111111111111111111111111111111111111112';
    expect(registryIdForMint(upper)).not.toBe(registryIdForMint(lower));
  });

  it('fits tokens.id, which is VARCHAR(64)', () => {
    // Longest possible Solana mint is 44 characters.
    expect(registryIdForMint('a'.repeat(44)).length).toBeLessThanOrEqual(64);
  });
});

describe('parseArgs', () => {
  it('defaults to a batch size within the Birdeye per-request cap', () => {
    const opts = parseArgs([]);
    expect(opts.batchSize).toBeLessThanOrEqual(100);
    expect(opts.dryRun).toBe(false);
    expect(opts.limit).toBe(0);
  });

  it('clamps an oversized batch to the cap', () => {
    // Birdeye rejects more than 100 addresses per request; silently sending
    // 500 would fail every batch.
    expect(parseArgs(['--batch', '500']).batchSize).toBe(100);
  });

  it('reads the flags and thresholds', () => {
    const opts = parseArgs(['--dry-run', '--limit', '250', '--min-liquidity', '20000']);
    expect(opts.dryRun).toBe(true);
    expect(opts.limit).toBe(250);
    expect(opts.minLiquidityUsd).toBe(20_000);
  });

  it('ignores a non-numeric value rather than passing NaN into SQL', () => {
    expect(parseArgs(['--limit', 'lots']).limit).toBe(0);
    expect(parseArgs(['--min-volume']).minVolumeUsd).toBe(1_000);
  });
});
