import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { chain, address } = params;

    const topTraders = [
      { rank: 1, wallet: '1aM3...2b88', tag: 'Elite Scalper', totalTrades: 48, winRate: '87.5%', totalProfitSol: '+184.5 SOL', totalProfitUsd: '+$27,675', roi: '+420%' },
      { rank: 2, wallet: '4zW8...9kL2', tag: 'Whale Accumulator', totalTrades: 22, winRate: '91.0%', totalProfitSol: '+142.2 SOL', totalProfitUsd: '+$21,330', roi: '+315%' },
      { rank: 3, wallet: '9pQ1...4c00', tag: 'Momentum Bot', totalTrades: 114, winRate: '79.2%', totalProfitSol: '+96.8 SOL', totalProfitUsd: '+$14,520', roi: '+194%' },
      { rank: 4, wallet: '8tV3...1m44', tag: 'Swing Trader', totalTrades: 19, winRate: '84.2%', totalProfitSol: '+71.4 SOL', totalProfitUsd: '+$10,710', roi: '+165%' },
    ];

    return jsonResponse({
      token: address,
      chain: chain.toLowerCase(),
      topTraders,
      count: topTraders.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch top traders', 500));
  }
}
