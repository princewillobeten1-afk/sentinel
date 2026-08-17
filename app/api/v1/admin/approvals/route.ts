import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminDualApprovalEngine } from '@/lib/admin/dual-approval';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/approvals — list pending and historical dual-approval proposals. */
export async function GET() {
  try {
    const pending = adminDualApprovalEngine.listPending();
    const all = adminDualApprovalEngine.listAll();
    return jsonResponse({ pending, all });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load dual approval proposals', 500));
  }
}

/** POST /api/v1/admin/approvals — create proposal, approve, or reject. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, proposalId, actionType, payload, requestedBy, requestedByRole, approvedBy, approvedByRole, rejectedBy, rejectedByRole, reason, rejectionReason } = body;

    if (action === 'PROPOSE') {
      const proposal = adminDualApprovalEngine.propose({
        actionType,
        payload,
        requestedBy: requestedBy || 'admin_user',
        requestedByRole: requestedByRole || 'ADMIN',
        reason: reason || 'Sensitive operational request',
      });
      return jsonResponse({ proposal });
    }

    if (action === 'APPROVE' && proposalId) {
      const proposal = adminDualApprovalEngine.approve({
        proposalId,
        approvedBy: approvedBy || 'admin_approver',
        approvedByRole: approvedByRole || 'SUPER_ADMIN',
      });
      return jsonResponse({ proposal });
    }

    if (action === 'REJECT' && proposalId) {
      const proposal = adminDualApprovalEngine.reject({
        proposalId,
        rejectedBy: rejectedBy || 'admin_rejecter',
        rejectedByRole: rejectedByRole || 'SUPER_ADMIN',
        rejectionReason: rejectionReason || reason || 'Declined by reviewer',
      });
      return jsonResponse({ proposal });
    }

    throw new ApiError('Invalid action for dual approvals endpoint', 400);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Dual approval operation failed', 500));
  }
}
