/**
 * One price source for SOL, so the app stops disagreeing with itself.
 *
 * ## The problem this solves
 *
 * SOL had three prices on screen at once:
 *
 *   - **$142.50** in the status bar — a literal in `solana-provider.ts`'s
 *     catch block, returned on every Birdeye failure, which is every call
 *     since that quota is exhausted. The same block also supplied the `$3.45`
 *     that appeared as a swap price and the phantom `SENT` trending token.
 *   - **$150.00** in `trading/instant` — a second literal, used to compute the
 *     USD value of a trade.
 *   - **$94.88** in Discover — the only correct one, from Jupiter.
 *
 * A trader cannot size a position against a product that reports three prices
 * for the same asset. Everything now derives from here.
 *
 * ## It returns null rather than a default
 *
 * There is no fallback constant. When the price cannot be fetched the answer is
 * `null`, and callers render an em-dash. A stale-but-plausible number is what
 * created this problem: $142.50 looked like a real SOL price for as long as
 * nobody compared it to the market.
 */

const JUPITER_PRICE_URL = 'https://lite-api.jup.ag/price/v3';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SOL_DEX_PRICE_URL = `https://api.dexscreener.com/tokens/v1/solana/${SOL_MINT}`;
const USD_QUOTES = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkSm3boRT7sR5Nf8', // USDT
]);

const CACHE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 6_000;

interface PriceEntry {
  usdPrice: number;
  priceChange24h: number | null;
  fetchedAt: number;
  source: 'jupiter-price-v3' | 'dexscreener-sol-usd';
}

const cache = new Map<string, PriceEntry>();
const pending = new Map<string, Promise<PriceEntry | null>>();

function positive(value: unknown): number | null {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchSolDexPrice(signal: AbortSignal): Promise<PriceEntry | null> {
  const response = await fetch(SOL_DEX_PRICE_URL, {
    signal, headers: { accept: 'application/json' }, cache: 'no-store',
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (!Array.isArray(body)) return null;
  const pairs = body.filter((pair): pair is Record<string, any> => pair !== null && typeof pair === 'object')
    .filter(pair => pair.chainId === 'solana' && pair.baseToken?.address === SOL_MINT
      && USD_QUOTES.has(pair.quoteToken?.address)
      && positive(pair.priceUsd) !== null && positive(pair.liquidity?.usd) !== null
      && positive(pair.liquidity.usd)! >= 100_000)
    .sort((a, b) => positive(b.liquidity?.usd)! - positive(a.liquidity?.usd)!);
  const pair = pairs[0];
  if (!pair) return null;
  const change = Number(pair.priceChange?.h24);
  return { usdPrice: positive(pair.priceUsd)!,
    priceChange24h: Number.isFinite(change) ? change : null,
    fetchedAt: Date.now(), source: 'dexscreener-sol-usd' };
}

async function fetchPrice(mint: string): Promise<PriceEntry | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${JUPITER_PRICE_URL}?ids=${mint}`, {
      signal: controller.signal, headers: { accept: 'application/json' }, cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as Record<string, { usdPrice?: number; priceChange24h?: number }>;
      const entry = body?.[mint];
      const price = positive(entry?.usdPrice);
      if (price !== null) {
        const change = Number(entry?.priceChange24h);
        return { usdPrice: price, priceChange24h: Number.isFinite(change) ? change : null,
          fetchedAt: Date.now(), source: 'jupiter-price-v3' };
      }
    }
  } catch { /* Try the independent SOL/USD pool source below. */ }
  finally { clearTimeout(timer); }
  if (mint !== SOL_MINT) return null;
  const fallbackController = new AbortController();
  const fallbackTimer = setTimeout(() => fallbackController.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetchSolDexPrice(fallbackController.signal); }
  catch { return null; }
  finally { clearTimeout(fallbackTimer); }
}

/** Parsed price for a mint, or null when it genuinely could not be fetched. */
export async function getTokenPriceUsd(
  mint: string,
): Promise<{ usdPrice: number; priceChange24h: number | null; ageMs: number; source: PriceEntry['source'] } | null> {
  const cached = cache.get(mint);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      usdPrice: cached.usdPrice,
      priceChange24h: cached.priceChange24h,
      ageMs: now - cached.fetchedAt,
      source: cached.source,
    };
  }
  let task = pending.get(mint);
  if (!task) {
    task = fetchPrice(mint);
    pending.set(mint, task);
    void task.finally(() => pending.delete(mint));
  }
  const record = await task;
  if (record) {
    cache.set(mint, record);
    return { usdPrice: record.usdPrice, priceChange24h: record.priceChange24h,
      ageMs: Date.now() - record.fetchedAt, source: record.source };
  }
  // A stale reading remains identified as stale by age; callers decide if it
  // is acceptable for display or a live trade conversion.
  return cached ? { usdPrice: cached.usdPrice, priceChange24h: cached.priceChange24h,
    ageMs: Date.now() - cached.fetchedAt, source: cached.source } : null;
}

/** SOL's price in USD, or null when unknown. */
export async function getSolPriceUsd(): Promise<number | null> {
  const entry = await getTokenPriceUsd(SOL_MINT);
  return entry?.usdPrice ?? null;
}

export function resetCanonicalPriceForTests(): void {
  cache.clear(); pending.clear();
}
