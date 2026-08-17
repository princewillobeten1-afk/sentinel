import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAuth } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { mfaStore } from '@/lib/server/mfa-store';
import { verifyTotp, verifyAndConsumeBackupCode } from '@/lib/server/mfa';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const disableSchema = z.object({ code: z.string().min(6).max(64) });

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    checkRateLimit(`mfa_disable_${user.userId}`, 5, 5 * 60000);

    const payload = await parseJsonBody(request);
    const data = validateSchema(disableSchema, payload);

    const record = mfaStore.get(user.userId);
    if (!record.enabled || !record.secret) {
      throw new ApiError('MFA is not enabled on this account.', 400, 'MFA_NOT_ENABLED');
    }

    const totpValid = verifyTotp(record.secret, data.code);
    const backupResult = totpValid ? null : verifyAndConsumeBackupCode(record.backupCodeHashes, data.code);

    if (!totpValid && !backupResult?.valid) {
      throw new ApiError('Incorrect code.', 401, 'MFA_CODE_INVALID');
    }

    mfaStore.disable(user.userId);
    recordAuditEvent({ userId: user.userId, action: 'MFA_DISABLED', entityType: 'mfa', entityId: user.userId });

    return jsonResponse({ enabled: false });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to disable MFA', 500));
  }
}
