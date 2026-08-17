export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { pgAlertRepository, type AlertRuleRow } from '@/lib/server/db/alert-repository';

/**
 * Alert rule configuration (Phase 4).
 *
 * Replaces a stub that returned one hardcoded rule to every caller and a POST
 * that echoed `rule_<timestamp>` without persisting anything.
 *
 * Rules carry a real lifecycle (ACTIVE/PAUSED/TRIGGERED/EXPIRED/DELETED,
 * `lib/alert/rule-state-machine.ts`) rather than the bare `enabled` boolean
 * 013 shipped with — a boolean cannot express EXPIRED, nor distinguish a
 * deleted rule from one that never existed.
 */

const conditionGroupSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.any());

const createRuleSchema = z.object({
  name: z.string().min(1).max(128),
  alertType: z.string().min(1).max(64),
  category: z.string().max(32).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  scope: conditionGroupSchema.optional(),
  conditions: conditionGroupSchema.optional(),
  channels: z.array(z.enum(['IN_APP', 'PUSH', 'EMAIL', 'WEBHOOK', 'SMS'])).optional(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional(),
});

import { toRuleDto } from './dto';

/** GET /api/v1/alert-rules — the caller's own rules. Soft-deleted ones are hidden. */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const rawLimit = Number(searchParams.get('limit') ?? 25);
    if (!Number.isFinite(rawLimit) || rawLimit < 1) {
      throw new ApiError('limit must be a positive number', 400, 'INVALID_REQUEST');
    }
    const limit = Math.min(rawLimit, 100);
    const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

    const [rows, total] = await Promise.all([
      pgAlertRepository.listRules(user.userId, { limit, offset }),
      pgAlertRepository.countRules(user.userId),
    ]);

    return jsonResponse({
      rules: rows.map(toRuleDto),
      meta: { total, limit, offset, hasMore: offset + rows.length < total },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to list alert rules', 500));
  }
}

/** POST /api/v1/alert-rules — create a rule. Starts ACTIVE. */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(createRuleSchema, payload);

    const rule = await pgAlertRepository.createRule({
      userId: user.userId,
      name: data.name,
      alertType: data.alertType,
      category: data.category ?? null,
      severity: data.severity ?? null,
      scope: data.scope,
      conditions: data.conditions,
      channels: data.channels,
      cooldownMinutes: data.cooldownMinutes,
    });

    return jsonResponse({ rule: toRuleDto(rule) }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to create alert rule', 500));
  }
}
