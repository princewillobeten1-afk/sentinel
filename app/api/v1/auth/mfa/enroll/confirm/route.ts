import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAuth } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { mfaStore } from '@/lib/server/mfa-store';
import { verifyTotp } from '@/lib/server/mfa';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({ code: z.string().min(6).max(8) });

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    checkRateLimit(`mfa_confirm_${user.userId}`, 5, 5 * 60000);

    const payload = await parseJsonBody(request);
    const data = validateSchema(confirmSchema, payload);

    const pending = mfaStore.get(user.userId);
    if (!pending.pendingSecret) {
      throw new ApiError('No MFA enrollment in progress. Call /mfa/enroll first.', 400, 'MFA_NO_PENDING_ENROLLMENT');
    }

    if (!verifyTotp(pending.pendingSecret, data.code)) {
      throw new ApiError('Incorrect code.', 401, 'MFA_CODE_INVALID');
    }

    mfaStore.confirmEnrollment(user.userId);
    recordAuditEvent({ userId: user.userId, action: 'MFA_ENROLLED', entityType: 'mfa', entityId: user.userId });

    return jsonResponse({ enabled: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to confirm MFA enrollment', 500));
  }
}
