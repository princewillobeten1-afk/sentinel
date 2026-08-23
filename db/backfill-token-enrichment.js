/**
 * Token enrichment backfill (Phase 5).
 *
 * `realtime_tokens` holds mints discovered by the Helius log subscription —
 * currently 930 of them, every market column NULL, because discovery carries
 * identity only. This job fills that market data from Birdeye and promotes the
 * tokens that qualify into the `tokens` registry, which is what
 * `/api/v1/tokens` serves and what the Overview's Top Tokens tab reads.
 *
 * Plain CommonJS invoked directly by `node`, same reasoning as `db/migrate.js`:
 * a standalone entry point outside Next's TS pipeline, so it cannot `require()`
 * the TypeScript under `lib/`. The two Birdeye calls are re-implemented here
 * against the same documented endpoints their typed wrappers use
 * (`lib/api/birdeye/price.ts`).
 *
 * ## Quota is the binding constraint
 *
 * Birdeye bills compute units, and the account is currently exhausted — a
 * trending probe returns `{"success":false,"message":"Compute units usage limit
 * exceeded"}` with an HTTP **200**, not a 429. Two consequences shape this job:
 *
 *  - **Batch, don't iterate.** 930 single-token calls would be 930x the cost of
 *    the batched POST endpoints, which take up to 100 mints per request. At the
 *    default batch size this run is ~20 requests per stage, not 1,860.
 *  - **Stop on exhaustion, don't grind.** Quota errors are terminal for the
 *    run: it records progress and exits 3 so a caller can distinguish "out of
 *    quota, try later" from "broken". Grinding through the remaining batches
 *    would spend nothing but time and produce nothing but identical errors.
 *
 * ## Resumability
 *
 * The work queue is `enrichment_status IN ('PENDING','ERROR')` ordered by
 * `enriched_at NULLS FIRST`, so a re-run continues where the last stopped and
 * never re-charges quota for rows already resolved. `NO_MARKET` is terminal by
 * design — a mint with no price source will not grow one on retry, and retrying
 * it every run is exactly how a quota gets burned on dead tokens. `--retry-dead`
 * exists for the case where that assumption is wrong (a token that later lists).
 *
 * ## Honesty
 *
 * A token with no market gets `enrichment_status = 'NO_MARKET'` and keeps NULL
 * price. It never gets a zero. Zero is a measurement; NULL is the absence of
 * one, and the UI renders the two differently on purpose ("—" vs "$0.00").
 *
 * Usage:
 *   node db/backfill-token-enrichment.js --dry-run     # plan only, no quota spent
 *   node db/backfill-token-enrichment.js               # enrich + promote
 *   node db/backfill-token-enrichment.js --limit 100   # cap the run
 *   node db/backfill-token-enrichment.js --promote-only # re-promote, no API calls
 *
 * Exit codes: 0 ok · 1 error · 3 quota exhausted (partial progress saved)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Mirrors db/migrate.js — same precedence, same quote handling. */
function loadEnv() {
  const envFiles = ['.env.local', '.env', '.env.development'];
  for (const file of envFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flag = (name) => argv.includes(`--${name}`);
  const value = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1 || i === argv.length - 1) return fallback;
    const n = Number(argv[i + 1]);
    return Number.isFinite(n) ? n : fallback;
  };

  const sourceIdx = argv.indexOf('--source');
  const source = sourceIdx !== -1 && sourceIdx < argv.length - 1 ? argv[sourceIdx + 1] : 'dexscreener';
  if (!['dexscreener', 'birdeye'].includes(source)) {
    throw new Error(`Unknown --source ${source}. Expected dexscreener or birdeye.`);
  }

  return {
    /**
     * DexScreener by default: it needs no key and works today, where the
     * Birdeye account answers 429 to everything.
     */
    source,
    dryRun: flag('dry-run'),
    promoteOnly: flag('promote-only'),
    /** Delete placeholder rows the mock generator wrote, before enriching. */
    purgeMock: flag('purge-mock'),
    /**
     * Re-price tokens that already have data.
     *
     * The ordinary queue skips `OK` rows so a resumed run never re-charges for
     * work already done. But a price is a measurement with a shelf life, and a
     * registry serving figures from last week is its own kind of dishonest —
     * so refreshing is a first-class mode, not an edge case.
     */
    refresh: flag('refresh'),
    /** Only re-price rows enriched longer ago than this. 0 = all of them. */
    staleMinutes: value('stale-minutes', 0),
    retryDead: flag('retry-dead'),
    verbose: flag('verbose'),
    /** Max mints to enrich this run. 0 = every pending row. */
    limit: value('limit', 0),
    /** Birdeye's batch endpoints accept up to 100 addresses per request. */
    batchSize: Math.min(value('batch', 50), 100),
    /** Courtesy gap between requests; Birdeye rate-limits per second. */
    delayMs: value('delay', 350),
    /**
     * Promotion gate. A registry filled with 930 dead mints is worse than one
     * holding 5 real tokens — the Top Tokens tab would be unusable. These are
     * the floors a token clears to earn a registry row.
     */
    minLiquidityUsd: value('min-liquidity', 5_000),
    minVolumeUsd: value('min-volume', 1_000),
  };
}

// ---------------------------------------------------------------------------
// Birdeye
// ---------------------------------------------------------------------------

const BIRDEYE_BASE = 'https://public-api.birdeye.so';

/** Thrown when the account is out of compute units. Terminal for the run. */
class QuotaExhaustedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

/**
 * Recognises quota exhaustion in either shape Birdeye uses for it.
 *
 * The important case is the non-obvious one: exhaustion arrives as HTTP **200**
 * with `success: false`, so a status-code check alone treats it as a successful
 * response carrying no data — and the caller silently writes NULLs over the
 * whole batch. That is the bug this function exists to prevent.
 */
function isQuotaMessage(message) {
  return /compute unit|usage limit|quota|rate limit/i.test(String(message ?? ''));
}

async function birdeyeFetch(endpoint, apiKey, init) {
  const res = await fetch(`${BIRDEYE_BASE}${endpoint}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'x-chain': 'solana',
      'X-API-KEY': apiKey,
      ...(init && init.headers ? init.headers : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) throw new QuotaExhaustedError('Birdeye rate limit exceeded (429)');
  if (!res.ok) throw new Error(`Birdeye ${res.status} ${res.statusText}`);

  const body = await res.json();
  if (body && body.success === false) {
    const message = body.message || 'unknown Birdeye error';
    if (isQuotaMessage(message)) throw new QuotaExhaustedError(message);
    throw new Error(message);
  }
  return body.data;
}

/** POST /defi/multi_price — price, 24h change, liquidity. Up to 100 mints. */
function fetchMultiPrice(mints, apiKey) {
  return birdeyeFetch('/defi/multi_price?include_liquidity=true', apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list_address: mints.join(',') }),
  });
}

/** POST /defi/price_volume/multi — 24h volume. Up to 100 mints. */
function fetchPriceVolume(mints, apiKey) {
  return birdeyeFetch('/defi/price_volume/multi', apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list_address: mints.join(','), type: '24h' }),
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Is this a syntactically valid Solana mint address?
 *
 * Base58, 32–44 characters. Base58 deliberately omits `0`, `O`, `I` and `l`
 * because they are visually ambiguous, so their presence proves the string was
 * never a real address.
 *
 * This gate exists because the enrichment table can hold placeholder rows —
 * `MOCK_REALTIME=true` fills it with `MockToken…` mints — and sending those to
 * Birdeye spends real compute units to be told, correctly, that no such token
 * exists. Filtering them here costs nothing and protects a scarce quota.
 */
function isValidSolanaMint(mint) {
  return typeof mint === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
}

// ---------------------------------------------------------------------------
// DexScreener — the keyless provider, and the default
// ---------------------------------------------------------------------------

/**
 * Birdeye is not the only way to price a Solana token, and right now it is not
 * a working one: the account returns HTTP 429 on every request, spaced or not,
 * because its compute-unit allowance is spent. DexScreener needs no key, no
 * account and no quota, and returns all four fields this job writes — price,
 * liquidity, 24h volume and 24h change — so it is the default source.
 *
 * Birdeye stays available behind `--source birdeye` for when the quota resets;
 * it carries data DexScreener does not (holder counts, security flags) that
 * later work will want.
 */
const DEXSCREENER_BASE = 'https://api.dexscreener.com';

/** DexScreener accepts up to 30 comma-separated addresses per request. */
const DEXSCREENER_MAX_BATCH = 30;

async function dexScreenerRequest(mints) {
  const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${mints.join(',')}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) throw new QuotaExhaustedError('DexScreener rate limit (429)');
  if (!res.ok) throw new Error(`DexScreener ${res.status} ${res.statusText}`);

  const body = await res.json();
  return selectBestPairs(body && body.pairs, mints);
}

/**
 * Prices a batch, then individually re-queries whatever the batch missed.
 *
 * The batch response is capped at 30 pairs **in total**, not per token. A token
 * that trades in many pools therefore crowds the others out: asking for SOL,
 * USDC, JUP, BONK and WIF together returned thirty JUP/BONK/WIF pairs and not
 * one for SOL or USDC, so both looked like they had no market at all. Treating
 * that as "no market" would have written the wrong answer for the two most
 * liquid tokens on the chain.
 *
 * A single-mint request cannot be crowded out, so anything missing from the
 * batch is asked for on its own. The batch still does the bulk of the work; the
 * follow-ups are the exception, and a token that is genuinely unlisted costs
 * exactly one extra request to confirm.
 */
async function fetchDexScreener(mints, delayMs, onRequest) {
  const found = await dexScreenerRequest(mints);
  if (onRequest) onRequest();

  const missing = mints.filter((m) => !found[m]);
  if (missing.length === 0 || mints.length === 1) return found;

  for (const mint of missing) {
    await sleep(delayMs);
    const single = await dexScreenerRequest([mint]);
    if (onRequest) onRequest();
    if (single[mint]) found[mint] = single[mint];
  }
  return found;
}

/**
 * Quote assets whose own USD price is dependable.
 *
 * DexScreener derives a pair's `priceUsd` through its quote asset, so that
 * figure is only as good as the quote asset's own pricing. When the quote is
 * thin or mispriced the derived USD price is garbage — and it is *confidently*
 * garbage, carrying full precision and deep liquidity.
 */
const TRUSTED_QUOTE_SYMBOLS = new Set(['USDC', 'USDT', 'SOL', 'WSOL', 'USDS', 'PYUSD']);

/**
 * Reduces DexScreener's flat pair list to one entry per requested mint.
 *
 * Three things make this non-trivial, and each one silently prices the wrong
 * asset when handled naively. All three were observed against live responses
 * for SOL and JUP:
 *
 *  1. **Pairs, not tokens.** A request returns every pool the token appears in,
 *     including ones where it is the *quote* side; reading `priceUsd` there
 *     gives the other token's price. Only base-side pairs describe this mint.
 *  2. **Other chains reuse the same address strings.** A query for Solana's
 *     wrapped-SOL mint returns a `fogo`-chain pair carrying the identical
 *     address, and matching on address alone priced SOL at $0.0096 — FOGO's
 *     price — instead of ~$95. The chain has to be checked, not assumed.
 *  3. **Depth does not imply a trustworthy USD price.** JUP's deepest pools are
 *     quoted in MET and report ~$955 against a true price near $0.21, which the
 *     thinner JUP/USDC pool reports correctly. Picking purely by liquidity
 *     chooses the $160M pool and is wrong by four orders of magnitude.
 *
 * So: Solana base-side pairs only, preferring a trusted quote asset, and
 * deepest-first *within* that preference. A token quoted only in exotic assets
 * still resolves, because a best-effort price beats none — but it can never
 * outrank a stable-quoted pair.
 */
function selectBestPairs(pairs, mints) {
  const wanted = new Set(mints);
  const best = {};

  const rank = (pair) => {
    const quote = String((pair.quoteToken && pair.quoteToken.symbol) || '').toUpperCase();
    return {
      trusted: TRUSTED_QUOTE_SYMBOLS.has(quote) ? 1 : 0,
      liquidity: num(pair.liquidity && pair.liquidity.usd) ?? 0,
    };
  };

  for (const pair of Array.isArray(pairs) ? pairs : []) {
    if (!pair || pair.chainId !== 'solana') continue;

    const address = pair.baseToken && pair.baseToken.address;
    if (!address || !wanted.has(address)) continue;

    const incumbent = best[address];
    if (!incumbent) {
      best[address] = pair;
      continue;
    }

    const a = rank(pair);
    const b = rank(incumbent);
    // Trusted quote first, then depth. Never depth alone.
    if (a.trusted > b.trusted || (a.trusted === b.trusted && a.liquidity > b.liquidity)) {
      best[address] = pair;
    }
  }
  return best;
}

/** Maps one DexScreener pair onto the columns this job writes. */
function mapDexScreenerPair(pair) {
  const price = num(pair && pair.priceUsd);
  if (price === null) return null;

  return {
    priceUsd: price,
    priceChange24h: num(pair.priceChange && pair.priceChange.h24),
    liquidityUsd: num(pair.liquidity && pair.liquidity.usd),
    volume24hUsd: num(pair.volume && pair.volume.h24),
    // DexScreener reports both marketCap and fdv. `marketCap` is the
    // circulating-supply figure; fdv assumes full dilution and is the larger,
    // more flattering number. Preferring fdv would overstate every token here.
    marketCapUsd: num(pair.marketCap),
  };
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Finite numbers only. `null` for anything else, so unknown stays unknown. */
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Merges the two batch responses for one mint.
 *
 * `multi_price` reports `priceChange24h` already as a percent; `price_volume`
 * reports the same figure as `priceChangePercent`. Either is fine, but they
 * must not be mixed with a fraction — 8.65 and 0.0865 render three orders of
 * magnitude apart, and the whole point of this job is numbers you can trust.
 */
function mergeEnrichment(priceEntry, volumeEntry) {
  const price = num(priceEntry && priceEntry.value) ?? num(volumeEntry && volumeEntry.price);
  if (price === null) return null;

  return {
    priceUsd: price,
    priceChange24h:
      num(priceEntry && priceEntry.priceChange24h) ??
      num(volumeEntry && volumeEntry.priceChangePercent),
    liquidityUsd: num(priceEntry && priceEntry.liquidity),
    volume24hUsd: num(volumeEntry && volumeEntry.volumeUSD),
    // Market cap needs circulating supply, which neither batch endpoint
    // returns. Per-token /defi/token_overview would cost one call per mint —
    // 930 calls against an exhausted quota to fill one column. Left NULL, which
    // the UI renders as "—" rather than inventing a figure.
    marketCapUsd: null,
  };
}

// ---------------------------------------------------------------------------
// Stage 0 — prepare the work queue
// ---------------------------------------------------------------------------

/**
 * Removes placeholder rows written by the mock event generator.
 *
 * `realtimeProcessor.startMockGenerator()` (lib/server/events/processor.ts)
 * invents mints as `MockToken<timestamp><random>` with names like "Super Gem
 * 41". They are indistinguishable from real discoveries by shape alone, so they
 * are identified the same way the enrichment gate identifies them: a real
 * Solana mint is base58, and these are not.
 *
 * Deleted rather than marked, because they do not describe anything that
 * exists. Their trades go with them — a trade against a token that was never
 * real is not a record worth keeping.
 */
async function purgeMockRows(client, opts) {
  const { rows } = await client.query(
    `SELECT mint FROM realtime_tokens WHERE mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'`,
  );
  if (rows.length === 0) {
    console.log('  no placeholder rows found');
    return 0;
  }

  console.log(`  ${rows.length} placeholder row(s) to delete (e.g. ${rows[0].mint})`);
  if (opts.dryRun) return 0;

  const mints = rows.map((r) => r.mint);
  await client.query('DELETE FROM realtime_trades WHERE mint = ANY($1)', [mints]).catch(() => {});
  const res = await client.query('DELETE FROM realtime_tokens WHERE mint = ANY($1)', [mints]);
  return res.rowCount;
}

/**
 * Ensures every registry token has an enrichment row.
 *
 * The two tables are populated from opposite ends: `realtime_tokens` by live
 * discovery, `tokens` by seeding and promotion. Without this step the tokens
 * already in the registry — SOL, USDC, BONK, JUP, WIF, all real mints — would
 * never be priced, because nothing ever put them in the enrichment queue. That
 * is precisely why the Overview showed five tokens and no numbers.
 */
async function syncRegistryIntoQueue(client, opts) {
  const { rows } = await client.query(
    `SELECT t.address, t.symbol, t.name, t.decimals, t.logo_url
       FROM tokens t
       LEFT JOIN realtime_tokens r ON r.mint = t.address
      WHERE r.mint IS NULL`,
  );
  if (rows.length === 0) {
    console.log('  registry already fully queued');
    return 0;
  }

  console.log(`  ${rows.length} registry token(s) missing an enrichment row`);
  if (opts.dryRun) return 0;

  for (const t of rows) {
    await client.query(
      `INSERT INTO realtime_tokens (mint, symbol, name, decimals, image_url, platform, enrichment_status)
       VALUES ($1, $2, $3, $4, $5, 'registry', 'PENDING')
       ON CONFLICT (mint) DO NOTHING`,
      [t.address, t.symbol, t.name, t.decimals, t.logo_url],
    );
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Stage 1 — enrich
// ---------------------------------------------------------------------------

async function enrich(client, opts, apiKey) {
  const statuses = ['PENDING', 'ERROR'];
  if (opts.retryDead) statuses.push('NO_MARKET');
  if (opts.refresh) statuses.push('OK');

  // Under --refresh with a staleness window, rows priced inside the window are
  // left alone; the oldest are served first, so a capped run refreshes what is
  // most out of date rather than an arbitrary slice.
  const staleClause =
    opts.refresh && opts.staleMinutes > 0
      ? `AND (enriched_at IS NULL OR enriched_at < NOW() - INTERVAL '${Number(opts.staleMinutes)} minutes')`
      : '';

  const { rows: queue } = await client.query(
    `SELECT mint FROM realtime_tokens
      WHERE enrichment_status = ANY($1)
      ${staleClause}
      ORDER BY enriched_at ASC NULLS FIRST, first_seen_at DESC
      ${opts.limit > 0 ? 'LIMIT ' + opts.limit : ''}`,
    [statuses],
  );

  // Screened before any request is sent: an unspendable address must not cost
  // a compute unit to reject.
  const mints = [];
  const invalid = [];
  for (const row of queue) {
    (isValidSolanaMint(row.mint) ? mints : invalid).push(row.mint);
  }

  const stats = { queued: mints.length, ok: 0, noMarket: 0, failed: 0, invalid: invalid.length, requests: 0 };

  if (invalid.length > 0) {
    console.log(`  ${invalid.length} mint(s) are not valid Solana addresses — skipped without spending quota`);
    if (!opts.dryRun) {
      await client.query(
        `UPDATE realtime_tokens
            SET enrichment_status = 'NO_MARKET',
                enrichment_error  = 'not a valid Solana mint address',
                enriched_at       = NOW()
          WHERE mint = ANY($1)`,
        [invalid],
      );
    }
  }

  if (mints.length === 0) return { stats, quotaHit: false };

  // Each provider caps its own batch, so the effective size is the smaller of
  // what the user asked for and what the endpoint accepts.
  const useDex = opts.source === 'dexscreener';
  const batchSize = useDex ? Math.min(opts.batchSize, DEXSCREENER_MAX_BATCH) : opts.batchSize;

  const batches = [];
  for (let i = 0; i < mints.length; i += batchSize) {
    batches.push(mints.slice(i, i + batchSize));
  }

  console.log(
    `  ${mints.length} mint(s) queued in ${batches.length} batch(es) of up to ${batchSize}` +
      ` — ~${batches.length * (useDex ? 1 : 2)} ${opts.source} request(s)`,
  );

  if (opts.dryRun) {
    console.log('  --dry-run: no requests sent, nothing written.');
    return { stats, quotaHit: false };
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    // `resolve(mint)` returns this job's column set, or null for "no market".
    // Each provider supplies its own; the write loop below never learns which
    // one it is talking to.
    let resolve;

    try {
      if (useDex) {
        const pairs = await fetchDexScreener(batch, opts.delayMs, () => stats.requests++);
        resolve = (mint) => mapDexScreenerPair(pairs[mint]);
      } else {
        const prices = (await fetchMultiPrice(batch, apiKey)) || {};
        stats.requests++;
        await sleep(opts.delayMs);
        const volumes = (await fetchPriceVolume(batch, apiKey)) || {};
        stats.requests++;
        resolve = (mint) => mergeEnrichment(prices[mint], volumes[mint]);
      }
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        console.log(`\n  Quota exhausted at batch ${b + 1}/${batches.length}: ${err.message}`);
        console.log('  Progress up to this batch is saved; re-run when the quota resets.');
        return { stats, quotaHit: true };
      }
      // A single failed batch is recorded and skipped — one bad mint in a
      // batch of 50 must not abort the other 880.
      console.warn(`  Batch ${b + 1} failed: ${err.message}`);
      await client.query(
        `UPDATE realtime_tokens
            SET enrichment_status = 'ERROR', enrichment_error = $2, enriched_at = NOW()
          WHERE mint = ANY($1)`,
        [batch, err.message.slice(0, 500)],
      );
      stats.failed += batch.length;
      await sleep(opts.delayMs);
      continue;
    }

    for (const mint of batch) {
      const merged = resolve(mint);

      if (!merged) {
        // No price from either source. Terminal, and explicitly not a zero.
        await client.query(
          `UPDATE realtime_tokens
              SET enrichment_status = 'NO_MARKET', enrichment_error = NULL, enriched_at = NOW()
            WHERE mint = $1`,
          [mint],
        );
        stats.noMarket++;
        continue;
      }

      await client.query(
        `UPDATE realtime_tokens
            SET price_usd        = $2,
                price_change_24h = $3,
                liquidity_usd    = $4,
                volume_24h_usd   = $5,
                market_cap_usd   = COALESCE($6, market_cap_usd),
                enrichment_status = 'OK',
                enrichment_error  = NULL,
                enriched_at      = NOW(),
                updated_at       = NOW()
          WHERE mint = $1`,
        [
          mint,
          merged.priceUsd,
          merged.priceChange24h,
          merged.liquidityUsd,
          merged.volume24hUsd,
          merged.marketCapUsd,
        ],
      );
      stats.ok++;
      if (opts.verbose) {
        console.log(`    ${mint} $${merged.priceUsd} liq=${merged.liquidityUsd ?? '—'}`);
      }
    }

    process.stdout.write(`\r  batch ${b + 1}/${batches.length} · ok ${stats.ok} · no-market ${stats.noMarket}   `);
    await sleep(opts.delayMs);
  }
  process.stdout.write('\n');

  return { stats, quotaHit: false };
}

// ---------------------------------------------------------------------------
// Stage 2 — promote into the registry
// ---------------------------------------------------------------------------

/**
 * The registry id for a mint: deterministic, so a re-run updates the same row
 * rather than creating a second one.
 *
 * Uses the **whole** mint, with its case intact. Both parts matter, and an
 * earlier version got both wrong:
 *
 *  - A truncated prefix is not unique. `MockToken17873511459355yh6e` and
 *    `MockToken1787351165989aswa8tp` share their first 16 characters, so both
 *    resolved to `tok_mocktoken1787351` and the `ON CONFLICT (id) DO UPDATE`
 *    quietly overwrote one token with the other — two mints in, one row out.
 *  - Lowercasing destroys information. Base58 is case-sensitive, so folding
 *    case can merge two genuinely different addresses into one id.
 *
 * `tok_` plus a 44-character mint is 48 characters, inside `tokens.id`'s
 * VARCHAR(64).
 */
function registryIdForMint(mint) {
  return `tok_${mint}`;
}

/**
 * Copies qualifying enriched tokens into `tokens`, the registry of record.
 *
 * Idempotent two ways: `ON CONFLICT (id)` for the insert, and
 * `promoted_token_id` recorded back on the source row. Re-running promotes only
 * what is newly eligible.
 *
 * `chain_id` is `chain_solana` to match the existing registry rows — the
 * discovery layer spells the same chain `solana`, and mixing the two is what
 * previously made a chain-filtered query return nothing.
 */
async function promote(client, opts) {
  const { rows: candidates } = await client.query(
    `SELECT mint, symbol, name, decimals, image_url, liquidity_usd, volume_24h_usd
       FROM realtime_tokens
      WHERE enrichment_status = 'OK'
        AND price_usd IS NOT NULL
        AND symbol IS NOT NULL
        AND COALESCE(liquidity_usd, 0) >= $1
        AND COALESCE(volume_24h_usd, 0) >= $2
        AND promoted_token_id IS NULL
      ORDER BY volume_24h_usd DESC NULLS LAST`,
    [opts.minLiquidityUsd, opts.minVolumeUsd],
  );

  console.log(
    `  ${candidates.length} token(s) clear the gate` +
      ` (liquidity >= $${opts.minLiquidityUsd.toLocaleString()},` +
      ` volume >= $${opts.minVolumeUsd.toLocaleString()})`,
  );

  if (opts.dryRun) {
    for (const c of candidates.slice(0, 10)) {
      console.log(`    ${c.symbol} liq=$${Number(c.liquidity_usd).toLocaleString()} vol=$${Number(c.volume_24h_usd).toLocaleString()}`);
    }
    if (candidates.length > 10) console.log(`    …and ${candidates.length - 10} more`);
    return { promoted: 0, skipped: candidates.length };
  }

  let promoted = 0;
  for (const c of candidates) {
    const tokenId = registryIdForMint(c.mint);

    // Conflict is resolved on (chain_id, address), the natural key — not on
    // `id`. A token can already be in the registry under an older id (`tok_sol`
    // predates this job's `tok_<mint>` scheme), and inserting a second row for
    // the same mint violates `uq_token_chain_address`. Updating in place keeps
    // the established id, which other tables reference.
    //
    // `RETURNING id` therefore yields the *existing* id on conflict, which is
    // what must be linked back — recording the id we would have used would
    // point at a row that does not exist.
    const { rows: upserted } = await client.query(
      `INSERT INTO tokens (id, chain_id, address, symbol, name, decimals, logo_url,
                           status, metadata_status, discovery_source, first_seen_at, created_at)
       -- 'OK', not 'COMPLETE': chk_tokens_metadata_status allows only
       -- PENDING | OK | FAILED | UNAVAILABLE.
       VALUES ($1, 'chain_solana', $2, $3, $4, $5, $6, 'ACTIVE', 'OK', 'realtime_backfill', NOW(), NOW())
       ON CONFLICT (chain_id, address) DO UPDATE
          SET symbol   = EXCLUDED.symbol,
              name     = EXCLUDED.name,
              logo_url = COALESCE(EXCLUDED.logo_url, tokens.logo_url),
              status   = 'ACTIVE'
       RETURNING id`,
      [
        tokenId,
        c.mint,
        String(c.symbol).slice(0, 64),
        String(c.name || c.symbol).slice(0, 128),
        c.decimals ?? 9,
        c.image_url,
      ],
    );

    await client.query('UPDATE realtime_tokens SET promoted_token_id = $2 WHERE mint = $1', [
      c.mint,
      upserted[0].id,
    ]);
    promoted++;
  }

  return { promoted, skipped: 0 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnv();
  const opts = parseArgs(process.argv.slice(2));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  // Only the Birdeye source needs a key; DexScreener is keyless, which is a
  // large part of why it is the default.
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (opts.source === 'birdeye' && !apiKey && !opts.dryRun && !opts.promoteOnly) {
    console.error('BIRDEYE_API_KEY is not set — --source birdeye needs it.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  console.log(`Token enrichment backfill · source=${opts.source}${opts.dryRun ? ' · dry run' : ''}`);

  const { rows: before } = await client.query(
    `SELECT enrichment_status AS s, COUNT(*)::int AS c FROM realtime_tokens GROUP BY 1 ORDER BY 1`,
  );
  console.log(`  source: ${before.map((r) => `${r.s} ${r.c}`).join(' · ')}`);

  let quotaHit = false;
  try {
    if (opts.purgeMock) {
      console.log('\nStage 0a — purge placeholder rows');
      const removed = await purgeMockRows(client, opts);
      if (!opts.dryRun) console.log(`  deleted ${removed} row(s)`);
    }

    console.log('\nStage 0b — queue registry tokens');
    await syncRegistryIntoQueue(client, opts);

    if (!opts.promoteOnly) {
      console.log(`\nStage 1 — enrich from ${opts.source}`);
      const result = await enrich(client, opts, apiKey);
      quotaHit = result.quotaHit;
      const s = result.stats;
      console.log(
        `  enriched ${s.ok} · no market ${s.noMarket} · invalid ${s.invalid} · failed ${s.failed}` +
          ` · ${s.requests} request(s)`,
      );
    }

    console.log('\nStage 2 — promote into the registry');
    const { promoted } = await promote(client, opts);
    if (!opts.dryRun) console.log(`  promoted ${promoted} token(s) into \`tokens\``);

    const { rows: registry } = await client.query('SELECT COUNT(*)::int AS c FROM tokens');
    console.log(`\nRegistry now holds ${registry[0].c} token(s).`);
  } finally {
    await client.end();
  }

  if (quotaHit) {
    console.log('\nStopped early: Birdeye quota exhausted. Re-run to continue.');
    process.exit(3);
  }
}

// Run only when invoked directly, so the pure helpers above can be unit-tested
// without the script connecting to Postgres on import. The enrichment path
// cannot be exercised end-to-end while the Birdeye quota is exhausted, which
// makes these tests the only proof the merge and quota rules are right.
if (require.main === module) {
  main().catch((err) => {
    console.error('\nBackfill failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  isQuotaMessage,
  isValidSolanaMint,
  mapDexScreenerPair,
  mergeEnrichment,
  selectBestPairs,
  registryIdForMint,
  num,
  parseArgs,
  QuotaExhaustedError,
};
