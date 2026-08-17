export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { pgAlertRepository, type AlertEventRow } from '@/lib/server/db/alert-repository';
import { READ_STATE_TRANSITIONS, type AlertEventReadState } from '@/lib/alert/rule-state-machine';

/**
 * A single fired alert, and its per-user read state.
 *
 * This was a stub: GET returned one hardcoded "MOMENTUM/RISK CONFLICT" story to
 * every caller, and PATCH echoed the request body back as `{success: true}`
 * without writing anything — so marking an alert read appeared to work and
 * silently didn't survive a refresh. Neither method checked authentication, so
 * any caller could read any alert id.
 *
 * The Phase 4 repository already had `getEventForUser` and `setReadState`
 * (with `SELECT … FOR UPDATE` and transition enforcement); nothing was calling
 * them. This routes to them.
 */

const READ_STATES = Object.keys(READ_STATE_TRANSITIONS) as AlertEventReadState[];

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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const row = await pgAlertRepository.getEventForUser(params.id, user.userId);

    // 404 rather than 403 for another user's alert: the caller has no
    // legitimate way to know the id exists, so confirming it would leak.
    if (!row) throw new ApiError('Alert not found', 404, 'ALERT_NOT_FOUND');

    return jsonResponse({ alert: toEventDto(row) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load alert', 500));
  }
}

/** PATCH — advance this user's read state for the alert, e.g. `{ readState: 'READ' }`. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const body = await request.json().catch(() => null);
    const next = body?.readState;

    if (!next || !READ_STATES.includes(next)) {
      throw new ApiError(
        `readState must be one of: ${READ_STATES.join(', ')}`,
        400,
        'INVALID_REQUEST',
      );
    }

    // Rejects illegal moves (e.g. DISMISSED back to UNREAD) with
    // INVALID_STATE_TRANSITION — the same enforcement the rule lifecycle uses.
    const row = await pgAlertRepository.setReadState(params.id, user.userId, next);

    return jsonResponse({ alert: toEventDto(row) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update alert', 500));
  }
}

/**
 * DELETE — dismissing an alert is a read-state change, not a row deletion: a
 * fired alert is part of the user's history and the rule that produced it may
 * still be active. Expressed as DISMISSED so the record survives.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const row = await pgAlertRepository.setReadState(params.id, user.userId, 'DISMISSED');
    return jsonResponse({ alert: toEventDto(row) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to dismiss alert', 500));
  }
}
