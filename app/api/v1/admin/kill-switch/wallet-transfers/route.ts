import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAdmin } from '@/lib/server/rbac';
import { killSwitch } from '@/lib/server/kill-switch';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const pauseSchema = z.object({ reason: z.string().min(1).max(500) });

/**
 * POST /api/v1/admin/kill-switch/wallet-transfers — pauses the
 * WALLET_TRANSFERS scope. Single-admin, deliberately not dual-control (see
 * lib/server/kill-switch.ts's header comment for why) — this hides the
 * Send UI and blocks new history entries; it can never stop a transaction a
 * user's own wallet has already signed and broadcast.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const data = validateSchema(pauseSchema, await parseJsonBody(request));

    const state = killSwitch.pause('WALLET_TRANSFERS', { reason: data.reason, triggeredBy: admin.userId, source: 'ADMIN' });

    recordAuditEvent({
      userId: admin.userId,
      action: 'KILL_SWITCH_TRIGGERED',
      entityType: 'kill_switch',
      entityId: 'WALLET_TRANSFERS',
      changes: { reason: data.reason },
    });

    return jsonResponse({ state });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to pause wallet transfers', 500));
  }
}

/** DELETE /api/v1/admin/kill-switch/wallet-transfers — resumes the WALLET_TRANSFERS scope. */
export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const state = killSwitch.resume('WALLET_TRANSFERS', { triggeredBy: admin.userId });

    recordAuditEvent({
      userId: admin.userId,
      action: 'KILL_SWITCH_RESET',
      entityType: 'kill_switch',
      entityId: 'WALLET_TRANSFERS',
    });

    return jsonResponse({ state });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to resume wallet transfers', 500));
  }
}
