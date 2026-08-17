import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminTreasuryService } from '@/lib/admin/treasury';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/treasury — treasury balances, revenue breakdown, and fee config. */
export async function GET() {
  try {
    const balances = adminTreasuryService.getTreasuryBalances();
    const totalUsd = adminTreasuryService.getTotalTreasuryUsd();
    const revenue = adminTreasuryService.getRevenueSummary();
    const fees = adminTreasuryService.getFeeConfiguration();

    return jsonResponse({
      balances,
      totalUsd,
      revenue,
      fees,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load treasury telemetry', 500));
  }
}

/** POST /api/v1/admin/treasury — update fee configuration. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { updates, updatedBy = 'admin_finance', updatedByRole = 'FINANCE', reason = 'Quarterly fee adjustment' } = body;

    const newFees = adminTreasuryService.updateFeeConfiguration(updates, {
      updatedBy,
      updatedByRole,
      reason,
    });

    return jsonResponse({ fees: newFees });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update fee configuration', 500));
  }
}
