export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { getDatabaseClient } from '@/lib/server/database';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const db = await getDatabaseClient();
    await db.query('SELECT 1');

    const overview = [
      { title: 'Organic Trending', value: '22 tokens', details: 'Fresh tokens with credible volume' },
      { title: 'Risk Alerts', value: '4 active', details: 'Insider and liquidity warnings' },
      { title: 'Wallet Tracker', value: '18 wallets', details: 'Tracked trader activity' },
      { title: 'Portfolio Value', value: '$138.4K', details: 'Estimated net value after fees' },
    ];

    return jsonResponse({ overview });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Request processing failed', 500));
  }
}
