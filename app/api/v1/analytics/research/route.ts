import { NextResponse } from 'next/server';
import { dbPool } from '@/lib/server/db/pool';
import { isSolanaMint } from '@/lib/market/chart-model';

export const dynamic = 'force-dynamic';

const sortOrder = {
  volume: 'realtime_tokens.volume_24h_usd DESC NULLS LAST',
  gainers: 'realtime_tokens.price_change_24h DESC NULLS LAST',
  decliners: 'realtime_tokens.price_change_24h ASC NULLS LAST',
  liquidity: 'realtime_tokens.liquidity_usd DESC NULLS LAST',
} as const;
type Sort = keyof typeof sortOrder;

type TokenRow = {
  mint: string; name: string | null; symbol: string | null;
  price_usd: string | null; price_change_24h: string | null;
  market_cap_usd: string | null; liquidity_usd: string | null;
  volume_24h_usd: string | null; buy_volume_24h_usd: string | null;
  sell_volume_24h_usd: string | null; organic_volume_24h_usd: string | null;
  holder_count: number | null; pool_address: string | null; enriched_at: string | null;
};

const amount = (value: string | number | null) => value === null ? null : Number(value);
const tokenFields = `mint, name, symbol, price_usd::text, price_change_24h::text,
  market_cap_usd::text, liquidity_usd::text, volume_24h_usd::text,
  buy_volume_24h_usd::text, sell_volume_24h_usd::text,
  organic_volume_24h_usd::text, holder_count, pool_address, enriched_at::text`;
const present = (row: TokenRow) => ({
  mint: row.mint, name: row.name, symbol: row.symbol,
  priceUsd: amount(row.price_usd), change24hPct: amount(row.price_change_24h),
  marketCapUsd: amount(row.market_cap_usd), liquidityUsd: amount(row.liquidity_usd),
  volume24hUsd: amount(row.volume_24h_usd), buyVolume24hUsd: amount(row.buy_volume_24h_usd),
  sellVolume24hUsd: amount(row.sell_volume_24h_usd), organicVolume24hUsd: amount(row.organic_volume_24h_usd),
  holderCount: row.holder_count, poolAddress: row.pool_address,
  observedAt: row.enriched_at ? new Date(row.enriched_at).toISOString() : null,
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sort = params.get('sort') ?? 'volume';
  const mint = params.get('mint');
  if (!(sort in sortOrder) || (mint !== null && !isSolanaMint(mint))) {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'Choose a valid ranking and Solana mint.' } }, { status: 400 });
  }

  try {
    const [leaderboard, selected, wallets] = await Promise.all([
      dbPool.query<TokenRow>(`SELECT ${tokenFields} FROM realtime_tokens
        WHERE enrichment_status = 'OK' AND price_usd > 0
          AND liquidity_usd >= 1000 AND volume_24h_usd >= 100
          AND ${sort === 'gainers' ? 'price_change_24h > 0' : sort === 'decliners' ? 'price_change_24h < 0' : 'TRUE'}
        ORDER BY ${sortOrder[sort as Sort]}, mint ASC LIMIT 20`),
      mint ? dbPool.query<TokenRow>(`SELECT ${tokenFields} FROM realtime_tokens WHERE mint = $1 AND enrichment_status = 'OK'`, [mint])
        : Promise.resolve({ rows: [] as TokenRow[] }),
      mint ? dbPool.query<{ wallet: string; buys: string; sells: string; provisional: string; last_seen: string }>(
        `SELECT wallet, COUNT(*) FILTER (WHERE side = 'BUY')::text AS buys,
                COUNT(*) FILTER (WHERE side = 'SELL')::text AS sells,
                COUNT(*) FILTER (WHERE commitment = 'processed')::text AS provisional,
                MAX(timestamp)::text AS last_seen
           FROM realtime_trades
          WHERE mint = $1 AND wallet IS NOT NULL
            AND timestamp > NOW() - INTERVAL '24 hours'
          GROUP BY wallet ORDER BY COUNT(*) DESC, MAX(timestamp) DESC LIMIT 10`, [mint])
        : Promise.resolve({ rows: [] as { wallet: string; buys: string; sells: string; provisional: string; last_seen: string }[] }),
    ]);
    return NextResponse.json({
      sort, selectedMint: mint, ranked: leaderboard.rows.map(present), token: selected.rows[0] ? present(selected.rows[0]) : null,
      observedWallets: wallets.rows.map(row => ({ address: row.wallet, buys: Number(row.buys),
        sells: Number(row.sells), provisional: Number(row.provisional), lastSeen: new Date(row.last_seen).toISOString() })),
      generatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: { code: 'ANALYTICS_UNAVAILABLE', message: 'Measured research data is temporarily unavailable.' } }, { status: 503 });
  }
}
