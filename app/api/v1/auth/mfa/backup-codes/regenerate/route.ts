import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAuth } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { mfaStore } from '@/lib/server/mfa-store';
import { verifyTotp, generateBackupCodes, hashBackupCode } from '@/lib/server/mfa';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const regenerateSchema = z.object({ code: z.string().min(6).max(8) });

/** Requires a live TOTP code (not a backup code — that would let one leaked backup code mint a fresh set). */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    checkRateLimit(`mfa_backup_regen_${user.userId}`, 5, 5 * 60000);

    const payload = await parseJsonBody(request);
    const data = validateSchema(regenerateSchema, payload);

    const record = mfaStore.get(user.userId);
    if (!record.enabled || !record.secret) {
      throw new ApiError('MFA is not enabled on this account.', 400, 'MFA_NOT_ENABLED');
    }

    if (!verifyTotp(record.secret, data.code)) {
      throw new ApiError('Incorrect code.', 401, 'MFA_CODE_INVALID');
    }

    const backupCodes = generateBackupCodes();
    mfaStore.replaceBackupCodeHashes(user.userId, backupCodes.map(hashBackupCode));
    recordAuditEvent({ userId: user.userId, action: 'MFA_ENROLLED', entityType: 'mfa', entityId: user.userId, changes: { action: 'backup_codes_regenerated' } });

    return jsonResponse({ backupCodes, notice: 'Store these now — shown only once. Previous backup codes no longer work.' });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to regenerate backup codes', 500));
  }
}
