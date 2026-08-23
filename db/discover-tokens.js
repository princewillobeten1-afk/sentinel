/**
 * Real token discovery (Phase 5).
 *
 * The Overview's token tabs were served by four hardcoded tokens in
 * `TokenDiscoveryPipeline.seedDefaults()` — two of them carrying truncated
 * display strings (`3mA1...4c90`) where a mint address belongs. This job
 * replaces that seed with tokens that actually trade, from a source that
 * actually measures them.
 *
 * ## Why Jupiter
 *
 * Birdeye is the codebase's incumbent market source and is currently unusable:
 * every request returns HTTP 429, spaced or not, because the account's
 * compute-unit allowance is spent. Jupiter's token API needs no key, no account
 * and no quota, and returns more than a price:
 *
 *  - `usdPrice`, `liquidity`, `mcap`, `fdv`, `holderCount`, `decimals`, `icon`
 *  - `stats24h` with `priceChange`, buy/sell volume, and — the reason this
 *    source was chosen — `buyOrganicVolume` / `sellOrganicVolume`.
 *
 * That last pair is the platform's whole premise. "Organic volume" is volume
 * with inorganic flow excluded, and until now the Overview rendered it as a
 * hardcoded $110,891,000. It is now measured.
 *
 * Two lists are pulled, because "trending" and "top" are different questions:
 *
 *  - `toptraded/24h` — most traded. This is what Trending means.
 *  - `toporganicscore/24h` — ranked by genuine activity rather than raw volume,
 *    which is the ranking this platform exists to prefer.
 *
 * Plain CommonJS invoked by `node`, same as `db/migrate.js` and
 * `db/backfill-token-enrichment.js`.
 *
 * Usage:
 *   node db/discover-tokens.js                 # both lists, 50 each
 *   node db/discover-tokens.js --limit 100     # deeper
 *   node db/discover-tokens.js --dry-run       # fetch and report, write nothing
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const JUPITER_BASE = 'https://lite-api.jup.ag';

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

/** Finite numbers only; `null` for anything else, so unknown stays unknown. */
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Base58, 32–44 chars. Matches the backfill's gate exactly. */
function isValidSolanaMint(mint) {
  return typeof mint === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
}

/**
 * Sums a pair of directional figures.
 *
 * `null` only when **both** sides are missing. A token with buys and no sells
 * has a real volume equal to its buys — treating one missing side as fatal
 * would discard a measurement we actually have, and treating a missing side as
 * zero when both are absent would invent one we do not.
 */
function sumSides(a, b) {
  const x = num(a);
  const y = num(b);
  if (x === null && y === null) return null;
  return (x ?? 0) + (y ?? 0);
}

/** Maps one Jupiter token onto the columns this job writes. */
function mapJupiterToken(t) {
  const mint = t && t.id;
  if (!isValidSolanaMint(mint)) return null;

  const price = num(t.usdPrice);
  if (price === null) return null;

  const s = t.stats24h || {};

  return {
    mint,
    symbol: String(t.symbol || '').slice(0, 64) || null,
    name: String(t.name || t.symbol || '').slice(0, 128) || null,
    decimals: num(t.decimals),
    imageUrl: typeof t.icon === 'string' ? t.icon : null,
    priceUsd: price,
    // Already a percent (+67.39 for TRUMP over 24h), not a fraction. Storing a
    // fraction here would render every move 100x too small.
    priceChange24h: num(s.priceChange),
    liquidityUsd: num(t.liquidity),
    marketCapUsd: num(t.mcap),
    fdvUsd: num(t.fdv),
    volume24hUsd: sumSides(s.buyVolume, s.sellVolume),
    organicVolume24hUsd: sumSides(s.buyOrganicVolume, s.sellOrganicVolume),
    // Kept directional as well as summed: the buy/sell split is a measurement,
    // and the endpoint that reports it was previously deriving 52/48 from a
    // constant because nothing stored the real figures.
    buyVolume24hUsd: num(s.buyVolume),
    sellVolume24hUsd: num(s.sellVolume),
    organicBuyVolume24hUsd: num(s.buyOrganicVolume),
    organicSellVolume24hUsd: num(s.sellOrganicVolume),
    traderCount24h: num(s.numTraders),
    buyCount24h: num(s.numBuys),
    sellCount24h: num(s.numSells),
    holderCount: num(t.holderCount),
  };
}

async function fetchList(listPath, limit) {
  const res = await fetch(`${JUPITER_BASE}/tokens/v2/${listPath}?limit=${limit}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Jupiter ${listPath}: ${res.status} ${res.statusText}`);

  const body = await res.json();
  if (!Array.isArray(body)) throw new Error(`Jupiter ${listPath}: expected an array`);
  return body;
}

async function main() {
  loadEnv();

  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx !== -1 && limitIdx < argv.length - 1 ? Number(argv[limitIdx + 1]) : 50;
  if (!Number.isFinite(limit) || limit < 1) {
    console.error('--limit must be a positive number');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log(`Token discovery via Jupiter${dryRun ? ' (dry run)' : ''} · limit ${limit} per list`);

  const lists = [
    ['toptraded/24h', 'most traded'],
    ['toporganicscore/24h', 'top organic score'],
  ];

  // Deduplicated across lists: a token can top both, and it is one token.
  const byMint = new Map();
  for (const [listPath, label] of lists) {
    let raw;
    try {
      raw = await fetchList(listPath, limit);
    } catch (err) {
      console.warn(`  ${label}: failed — ${err.message}`);
      continue;
    }

    let kept = 0;
    for (const t of raw) {
      const mapped = mapJupiterToken(t);
      if (!mapped) continue;
      if (!byMint.has(mapped.mint)) kept++;
      // Later lists do not clobber earlier ones; both carry the same figures.
      if (!byMint.has(mapped.mint)) byMint.set(mapped.mint, mapped);
    }
    console.log(`  ${label}: ${raw.length} returned, ${kept} new`);
  }

  const tokens = [...byMint.values()];
  console.log(`  ${tokens.length} distinct token(s) with a usable price`);

  if (tokens.length === 0) {
    console.log('Nothing to write.');
    return;
  }

  if (dryRun) {
    const top = tokens.slice().sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
    for (const t of top.slice(0, 10)) {
      const organic =
        t.organicVolume24hUsd !== null && t.volume24hUsd
          ? ` (${((t.organicVolume24hUsd / t.volume24hUsd) * 100).toFixed(1)}% organic)`
          : '';
      console.log(
        `    ${String(t.symbol).padEnd(10)} $${t.priceUsd} · vol $${Math.round(t.volume24hUsd ?? 0).toLocaleString()}${organic}`,
      );
    }
    console.log('  --dry-run: nothing written.');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  let written = 0;
  try {
    for (const t of tokens) {
      await client.query(
        `INSERT INTO realtime_tokens (
           mint, symbol, name, decimals, image_url, platform,
           price_usd, price_change_24h, liquidity_usd, market_cap_usd, fdv_usd,
           volume_24h_usd, organic_volume_24h_usd, holder_count,
           buy_volume_24h_usd, sell_volume_24h_usd,
           organic_buy_volume_24h_usd, organic_sell_volume_24h_usd,
           trader_count_24h, buy_count_24h, sell_count_24h,
           enrichment_status, enriched_at, market_source, updated_at
         ) VALUES ($1,$2,$3,$4,$5,'jupiter',$6,$7,$8,$9,$10,$11,$12,$13,
                   $14,$15,$16,$17,$18,$19,$20,'OK',NOW(),'jupiter',NOW())
         ON CONFLICT (mint) DO UPDATE SET
           symbol                 = COALESCE(EXCLUDED.symbol, realtime_tokens.symbol),
           name                   = COALESCE(EXCLUDED.name, realtime_tokens.name),
           decimals               = COALESCE(EXCLUDED.decimals, realtime_tokens.decimals),
           image_url              = COALESCE(EXCLUDED.image_url, realtime_tokens.image_url),
           price_usd              = EXCLUDED.price_usd,
           price_change_24h       = EXCLUDED.price_change_24h,
           liquidity_usd          = EXCLUDED.liquidity_usd,
           market_cap_usd         = EXCLUDED.market_cap_usd,
           fdv_usd                = EXCLUDED.fdv_usd,
           volume_24h_usd         = EXCLUDED.volume_24h_usd,
           organic_volume_24h_usd = EXCLUDED.organic_volume_24h_usd,
           holder_count           = EXCLUDED.holder_count,
           buy_volume_24h_usd     = EXCLUDED.buy_volume_24h_usd,
           sell_volume_24h_usd    = EXCLUDED.sell_volume_24h_usd,
           organic_buy_volume_24h_usd  = EXCLUDED.organic_buy_volume_24h_usd,
           organic_sell_volume_24h_usd = EXCLUDED.organic_sell_volume_24h_usd,
           trader_count_24h       = EXCLUDED.trader_count_24h,
           buy_count_24h          = EXCLUDED.buy_count_24h,
           sell_count_24h         = EXCLUDED.sell_count_24h,
           enrichment_status      = 'OK',
           enrichment_error       = NULL,
           enriched_at            = NOW(),
           market_source          = 'jupiter',
           updated_at             = NOW()`,
        [
          t.mint,
          t.symbol,
          t.name,
          t.decimals,
          t.imageUrl,
          t.priceUsd,
          t.priceChange24h,
          t.liquidityUsd,
          t.marketCapUsd,
          t.fdvUsd,
          t.volume24hUsd,
          t.organicVolume24hUsd,
          t.holderCount,
          t.buyVolume24hUsd,
          t.sellVolume24hUsd,
          t.organicBuyVolume24hUsd,
          t.organicSellVolume24hUsd,
          t.traderCount24h,
          t.buyCount24h,
          t.sellCount24h,
        ],
      );
      written++;
    }

    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(price_usd)::int AS priced,
              COUNT(organic_volume_24h_usd)::int AS organic
         FROM realtime_tokens`,
    );
    console.log(`\nWrote ${written} token(s).`);
    console.log(
      `Enrichment table: ${rows[0].total} row(s) · ${rows[0].priced} priced · ${rows[0].organic} with organic volume`,
    );
    console.log('\nNext: node db/backfill-token-enrichment.js --promote-only');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\nDiscovery failed:', err.message);
    process.exit(1);
  });
}

module.exports = { isValidSolanaMint, mapJupiterToken, num, sumSides };
