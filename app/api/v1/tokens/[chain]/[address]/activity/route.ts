import { jsonResponse, errorResponse } from '@/lib/server/api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const activity = [
      { id: 'act_1', side: 'buy', amount: '2,500 SENT', valueUsd: '$8,625.00', walletAddress: '7xK9...3a19', timestamp: '12s ago' },
      { id: 'act_2', side: 'sell', amount: '500 SENT', valueUsd: '$1,725.00', walletAddress: '3mR8...8kL1', timestamp: '34s ago' },
      { id: 'act_3', side: 'buy', amount: '12,000 SENT', valueUsd: '$41,400.00', walletAddress: '1aM3...2b88', timestamp: '1m ago' },
    ];

    return jsonResponse({
      address: params.address,
      activity,
      count: activity.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error('Failed to fetch token activity'));
  }
}
