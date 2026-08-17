export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { pgAlertRepository } from '@/lib/server/db/alert-repository';
import { toRuleDto } from '../dto';
import type { AlertRuleState } from '@/lib/alert/rule-state-machine';

/**
 * Single alert rule (Phase 4) — read, edit, pause/resume, soft-delete.
 * Every handler is ownership-checked before any state change.
 */

const patchSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  channels: z.array(z.enum(['IN_APP', 'PUSH', 'EMAIL', 'WEBHOOK', 'SMS'])).optional(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional(),
  conditions: z.record(z.string(), z.any()).optional(),
  scope: z.record(z.string(), z.any()).optional(),
  // Lifecycle change. DELETED is intentionally excluded — use DELETE.
  status: z.enum(['ACTIVE', 'PAUSED', 'EXPIRED']).optional(),
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const rule = await pgAlertRepository.getRuleForUser(params.id, user.userId);
    if (!rule) throw new ApiError('Alert rule not found', 404, 'ALERT_NOT_FOUND');
    return jsonResponse({ rule: toRuleDto(rule) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load alert rule', 500));
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(patchSchema, payload);

    const owned = await pgAlertRepository.getRuleForUser(params.id, user.userId);
    if (!owned) throw new ApiError('Alert rule not found', 404, 'ALERT_NOT_FOUND');

    // Field edits and a lifecycle change are separate operations; the status
    // change goes through the state machine so an illegal move (e.g. reviving
    // a DELETED rule) is rejected rather than silently written.
    if (data.status && data.status !== owned.status) {
      await pgAlertRepository.transitionRule(params.id, data.status as AlertRuleState, 'Changed by user');
    }

    const hasFieldEdits =
      data.name !== undefined ||
      data.severity !== undefined ||
      data.channels !== undefined ||
      data.cooldownMinutes !== undefined ||
      data.conditions !== undefined ||
      data.scope !== undefined;

    const rule = hasFieldEdits
      ? await pgAlertRepository.updateRule(params.id, user.userId, data)
      : (await pgAlertRepository.getRuleForUser(params.id, user.userId))!;

    return jsonResponse({ rule: toRuleDto(rule) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update alert rule', 500));
  }
}

/**
 * DELETE — soft delete (Sprint 42 §44). The row is kept and marked DELETED so
 * the alert events it already produced remain readable; destroying it would
 * orphan real history.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const owned = await pgAlertRepository.getRuleForUser(params.id, user.userId);
    if (!owned) throw new ApiError('Alert rule not found', 404, 'ALERT_NOT_FOUND');

    const rule = await pgAlertRepository.transitionRule(params.id, 'DELETED', 'Deleted by user');
    return jsonResponse({ rule: toRuleDto(rule) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to delete alert rule', 500));
  }
}
