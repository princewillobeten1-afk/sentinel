export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { pgAlertRepository, type AlertEventRow } from '@/lib/server/db/alert-repository';
import type { AlertEventReadState } from '@/lib/alert/rule-state-machine';

/**
 * Triggered-alert feed (Phase 4).
 *
 * Replaces a hardcoded 2-item array that was identical for every caller and
 * ignored authentication entirely, plus a POST that returned
 * `{success: true, id: 'alert_<timestamp>'}` without storing anything.
 *
 * This endpoint is the EVENT feed (things that fired). Rule configuration
 * lives at /api/v1/alert-rules — see 025's header for why the two lifecycles
 * are modelled separately.
 *
 * Creating alerts is deliberately NOT exposed here: an alert firing is a
 * consequence of a rule matching real market data, not something a client
 * should be able to POST into existence.
 */

const READ_STATES: AlertEventReadState[] = ['UNREAD', 'READ', 'ACTIONED', 'DISMISSED'];

/** DTO — `payload` and `alert_id` internals stay server-side. */
function toEventDto(row: AlertEventRow) {
  return {
    id: row.id,
    ruleId: row.alert_id,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    category: row.category,
    token: row.token_symbol,
    readState: row.read_state,
    timestamp: new Date(row.triggered_at).toISOString(),
  };
}

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

    const severity = searchParams.get('severity') ?? undefined;
    const readStateParam = searchParams.get('readState') ?? undefined;
    if (readStateParam && !READ_STATES.includes(readStateParam as AlertEventReadState)) {
      throw new ApiError(`Unknown readState: ${readStateParam}`, 400, 'INVALID_REQUEST');
    }

    const [rows, total] = await Promise.all([
      pgAlertRepository.listEvents(user.userId, {
        limit,
        offset,
        severity,
        readState: readStateParam as AlertEventReadState | undefined,
      }),
      pgAlertRepository.countEvents(user.userId, severity, readStateParam as AlertEventReadState | undefined),
    ]);

    return jsonResponse({
      alerts: rows.map(toEventDto),
      meta: { total, limit, offset, hasMore: offset + rows.length < total },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load alerts', 500));
  }
}
