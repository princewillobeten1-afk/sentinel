import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { chain, address } = params;

    const holders = [
      { rank: 1, address: 'Raydium CPMM Pool', tag: 'DEX Pool', balance: '184,200,000 $SENT', percent: '18.42%', valueUsd: '$7,828,500', isContract: true },
      { rank: 2, address: '7xK9...3a19', tag: 'Dev Creator (Vested)', balance: '80,000,000 $SENT', percent: '8.00%', valueUsd: '$3,400,000', isContract: false },
      { rank: 3, address: '4zW8...9kL2', tag: 'Whale #1', balance: '45,200,000 $SENT', percent: '4.52%', valueUsd: '$1,921,000', isContract: false },
      { rank: 4, address: '1aM3...2b88', tag: 'Smart Money', balance: '38,100,000 $SENT', percent: '3.81%', valueUsd: '$1,619,250', isContract: false },
      { rank: 5, address: '8tV3...1m44', tag: 'Early Sniper', balance: '29,400,000 $SENT', percent: '2.94%', valueUsd: '$1,249,500', isContract: false },
      { rank: 6, address: '3kL0...5v91', tag: 'Diamond Hands', balance: '22,500,000 $SENT', percent: '2.25%', valueUsd: '$956,250', isContract: false },
      { rank: 7, address: '9pQ1...4c00', tag: 'Whale #2', balance: '19,800,000 $SENT', percent: '1.98%', valueUsd: '$841,500', isContract: false },
      { rank: 8, address: '2zP9...8x12', tag: 'Trader', balance: '14,200,000 $SENT', percent: '1.42%', valueUsd: '$603,500', isContract: false },
    ];

    return jsonResponse({
      token: address,
      chain: chain.toLowerCase(),
      totalHoldersCount: 1420,
      top10ConcentrationPct: '24.50%',
      holders,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch holders', 500));
  }
}
