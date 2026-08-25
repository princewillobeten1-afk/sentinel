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

const CACHE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 6_000;

interface PriceEntry {
  usdPrice: number;
  priceChange24h: number | null;
  fetchedAt: number;
}

const cache = new Map<string, PriceEntry>();

/** Parsed price for a mint, or null when it genuinely could not be fetched. */
export async function getTokenPriceUsd(
  mint: string,
): Promise<{ usdPrice: number; priceChange24h: number | null; ageMs: number } | null> {
  const cached = cache.get(mint);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      usdPrice: cached.usdPrice,
      priceChange24h: cached.priceChange24h,
      ageMs: now - cached.fetchedAt,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${JUPITER_PRICE_URL}?ids=${mint}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`price service responded ${res.status}`);

    const body = (await res.json()) as Record<string, { usdPrice?: number; priceChange24h?: number }>;
    const entry = body?.[mint];
    const price = Number(entry?.usdPrice);
    if (!Number.isFinite(price) || price <= 0) return null;

    const change = Number(entry?.priceChange24h);
    const record: PriceEntry = {
      usdPrice: price,
      priceChange24h: Number.isFinite(change) ? change : null,
      fetchedAt: now,
    };
    cache.set(mint, record);
    return { usdPrice: price, priceChange24h: record.priceChange24h, ageMs: 0 };
  } catch {
    // Serve a stale reading rather than nothing, but say how old it is so a
    // caller can decide. Still never a constant.
    if (cached) {
      return {
        usdPrice: cached.usdPrice,
        priceChange24h: cached.priceChange24h,
        ageMs: now - cached.fetchedAt,
      };
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** SOL's price in USD, or null when unknown. */
export async function getSolPriceUsd(): Promise<number | null> {
  const entry = await getTokenPriceUsd(SOL_MINT);
  return entry?.usdPrice ?? null;
}
