export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import { transferService } from '@/lib/wallet/transfer-service';

/**
 * GET /api/v1/wallets/transactions — returns transaction history (deposits & withdrawals).
 */
export async function GET(request: Request) {
  try {
    let userId = 'user_001';
    try {
      const authUser = await requireAuth(request);
      userId = authUser.userId;
    } catch {
      // Demo fallback
    }

    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId') || undefined;

    const transactions = await transferService.getTransactionHistory(userId, walletId);
    return jsonResponse({ transactions, count: transactions.length }, 200);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch wallet transactions', 500)
    );
  }
}
