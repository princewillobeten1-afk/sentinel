import { NextResponse } from 'next/server';
import { isSolanaMint } from '@/lib/market/chart-model';
import { dbPool } from '@/lib/server/db/pool';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { tokenAddress: string } }) {
  if (!isSolanaMint(params.tokenAddress)) return NextResponse.json({ error: { code: 'INVALID_MINT' } }, { status: 400 });
  try {
    const { rows } = await dbPool.query<{
      mint: string; price_usd: string | null; price_change_24h: string | null;
      liquidity_usd: string | null; volume_24h_usd: string | null;
      buy_volume_24h_usd: string | null; sell_volume_24h_usd: string | null;
      organic_volume_24h_usd: string | null; holder_count: number | null;
      pool_address: string | null; enriched_at: string | null;
    }>(`SELECT mint, price_usd::text, price_change_24h::text, liquidity_usd::text,
          volume_24h_usd::text, buy_volume_24h_usd::text, sell_volume_24h_usd::text,
          organic_volume_24h_usd::text, holder_count, pool_address, enriched_at::text
         FROM realtime_tokens WHERE mint = $1 AND enrichment_status = 'OK'`, [params.tokenAddress]);
    const row = rows[0];
    if (!row) return NextResponse.json({ error: { code: 'NO_MEASURED_TOKEN' } }, { status: 404 });
    const num = (v: string | null) => v === null ? null : Number(v);
    return NextResponse.json({ tokenAddress: row.mint, timeframe: '24h',
      market: { priceUsd: num(row.price_usd), change24hPct: num(row.price_change_24h),
        liquidityUsd: num(row.liquidity_usd), holderCount: row.holder_count,
        poolAddress: row.pool_address },
      volumeDecomposition: { totalVolumeUsd: num(row.volume_24h_usd),
        buyVolumeUsd: num(row.buy_volume_24h_usd), sellVolumeUsd: num(row.sell_volume_24h_usd),
        organicVolumeUsd: num(row.organic_volume_24h_usd), washTradingProbabilityPct: null },
      positionExitability: null, observedAt: row.enriched_at ? new Date(row.enriched_at).toISOString() : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: { code: 'ANALYTICS_UNAVAILABLE' } }, { status: 503 });
  }
}
