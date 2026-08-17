import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminAuditService } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

const mockAdminTokens = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: '$SENT',
    name: 'Solana Sentinel',
    chain: 'solana',
    creator: 'Alpha Dev Team (9pQ1...4c00)',
    liquidityUsd: 1_850_000,
    volume24hUsd: 48_250_000,
    holdersCount: 4890,
    status: 'ACTIVE',
    riskScore: 12,
    exitabilityScore: 92,
    organicScore: 88,
    insiderScore: 14,
    reputationScore: 94,
  },
  {
    address: '3mA1...4c90',
    symbol: '$CYBER',
    name: 'Cyber Core AI',
    chain: 'solana',
    creator: 'Cyber Team (3mA1...4c90)',
    liquidityUsd: 420_000,
    volume24hUsd: 6_800_000,
    holdersCount: 1420,
    status: 'ACTIVE',
    riskScore: 35,
    exitabilityScore: 78,
    organicScore: 72,
    insiderScore: 32,
    reputationScore: 82,
  },
  {
    address: '9pW2...8b11',
    symbol: '$SOLM',
    name: 'Solana Meme',
    chain: 'solana',
    creator: 'Degen Creator (9pQ1...4c00)',
    liquidityUsd: 42_000,
    volume24hUsd: 2_400_000,
    holdersCount: 142,
    status: 'RESTRICTED',
    riskScore: 88,
    exitabilityScore: 18,
    organicScore: 26,
    insiderScore: 88,
    reputationScore: 22,
  },
];

/** GET /api/v1/admin/tokens — list tokens with admin intelligence scores and statuses. */
export async function GET() {
  try {
    return jsonResponse({ tokens: mockAdminTokens, count: mockAdminTokens.length });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to list admin tokens', 500));
  }
}

/** POST /api/v1/admin/tokens — update token status (ACTIVE, WATCH, RESTRICTED, HIDDEN, BLOCKED, ARCHIVED). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenAddress, newStatus, reason, updatedBy = 'admin_duty', updatedByRole = 'ADMIN' } = body;

    const token = mockAdminTokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase());
    if (!token) throw new ApiError('Token not found', 404);

    const prevStatus = token.status;
    token.status = newStatus;

    adminAuditService.record({
      actorId: updatedBy,
      actorRole: updatedByRole,
      action: 'TOKEN_STATUS_UPDATED',
      domain: 'tokens',
      resourceType: 'token',
      resourceId: tokenAddress,
      reason: reason || 'Administrative token review',
      changesBefore: { status: prevStatus },
      changesAfter: { status: newStatus },
    });

    return jsonResponse({ token });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update token status', 500));
  }
}
