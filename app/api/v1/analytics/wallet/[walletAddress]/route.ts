import { NextResponse } from 'next/server';
import { isSolanaMint } from '@/lib/market/chart-model';
import { dbPool } from '@/lib/server/db/pool';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { walletAddress: string } }) {
  if (!isSolanaMint(params.walletAddress)) return NextResponse.json({ error: { code: 'INVALID_WALLET' } }, { status: 400 });
  try {
    const { rows } = await dbPool.query<{ mint: string; buys: string; sells: string; last_seen: string }>(
      `SELECT mint, COUNT(*) FILTER (WHERE side = 'BUY')::text AS buys,
              COUNT(*) FILTER (WHERE side = 'SELL')::text AS sells, MAX(timestamp)::text AS last_seen
         FROM realtime_trades WHERE wallet = $1 AND commitment IN ('confirmed', 'finalized')
           AND timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY mint ORDER BY MAX(timestamp) DESC LIMIT 50`, [params.walletAddress]);
    return NextResponse.json({ walletAddress: params.walletAddress, window: '24h',
      activity: rows.map(row => ({ mint: row.mint, buys: Number(row.buys), sells: Number(row.sells),
        lastSeen: new Date(row.last_seen).toISOString() })),
      realizedPnlUsd: null, winRatePct: null, cluster: null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: { code: 'ANALYTICS_UNAVAILABLE' } }, { status: 503 });
  }
}
