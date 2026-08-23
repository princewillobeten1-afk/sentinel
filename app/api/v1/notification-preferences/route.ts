export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { dbPool } from '@/lib/server/db/pool';

/**
 * Notification preferences.
 *
 * Both handlers were stubs: GET returned the same fixed object to every caller
 * with no authentication, and PATCH echoed the request body back as
 * `{success: true}` without writing anything — so changing a preference
 * appeared to work and silently didn't survive a refresh.
 *
 * Storage is `user_settings.notification_preferences`, a JSONB column that
 * already existed. Preferences are per-user, so the id comes from the session.
 */

type Channel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'WEBHOOK';
type Category = 'MARKET' | 'RISK' | 'PORTFOLIO' | 'EXECUTION' | 'SYSTEM';

const CHANNELS: Channel[] = ['IN_APP', 'PUSH', 'EMAIL', 'WEBHOOK'];
const CATEGORIES: Category[] = ['MARKET', 'RISK', 'PORTFOLIO', 'EXECUTION', 'SYSTEM'];

interface NotificationPreferences {
  channelPreferences: Partial<Record<Category, Channel[]>>;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
  /** Critical alerts ignore quiet hours. On by default — a rug is not a "later". */
  overrideCritical: boolean;
}

const DEFAULTS: NotificationPreferences = {
  channelPreferences: {
    MARKET: ['IN_APP'],
    RISK: ['IN_APP', 'EMAIL'],
    PORTFOLIO: ['IN_APP'],
    EXECUTION: ['IN_APP'],
    SYSTEM: ['IN_APP'],
  },
  quietHoursStart: null,
  quietHoursEnd: null,
  quietHoursTimezone: 'UTC',
  overrideCritical: true,
};

/** `HH:MM`, or null for "not set". */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(input: unknown): Partial<NotificationPreferences> {
  if (!input || typeof input !== 'object') {
    throw new ApiError('Request body must be an object', 400, 'INVALID_REQUEST');
  }
  const body = input as Record<string, unknown>;
  const out: Partial<NotificationPreferences> = {};

  if (body.channelPreferences !== undefined) {
    if (typeof body.channelPreferences !== 'object' || body.channelPreferences === null) {
      throw new ApiError('channelPreferences must be an object', 400, 'INVALID_REQUEST');
    }
    const prefs: Partial<Record<Category, Channel[]>> = {};
    for (const [category, channels] of Object.entries(body.channelPreferences)) {
      if (!CATEGORIES.includes(category as Category)) {
        throw new ApiError(`Unknown category: ${category}`, 400, 'INVALID_REQUEST');
      }
      if (!Array.isArray(channels)) {
        throw new ApiError(`${category} must be an array of channels`, 400, 'INVALID_REQUEST');
      }
      for (const channel of channels) {
        if (!CHANNELS.includes(channel as Channel)) {
          throw new ApiError(`Unknown channel: ${channel}`, 400, 'INVALID_REQUEST');
        }
      }
      prefs[category as Category] = channels as Channel[];
    }
    out.channelPreferences = prefs;
  }

  for (const key of ['quietHoursStart', 'quietHoursEnd'] as const) {
    if (body[key] !== undefined) {
      const value = body[key];
      if (value !== null && (typeof value !== 'string' || !TIME.test(value))) {
        throw new ApiError(`${key} must be HH:MM or null`, 400, 'INVALID_REQUEST');
      }
      out[key] = value as string | null;
    }
  }

  if (body.quietHoursTimezone !== undefined) {
    if (typeof body.quietHoursTimezone !== 'string') {
      throw new ApiError('quietHoursTimezone must be a string', 400, 'INVALID_REQUEST');
    }
    out.quietHoursTimezone = body.quietHoursTimezone;
  }

  if (body.overrideCritical !== undefined) {
    if (typeof body.overrideCritical !== 'boolean') {
      throw new ApiError('overrideCritical must be a boolean', 400, 'INVALID_REQUEST');
    }
    out.overrideCritical = body.overrideCritical;
  }

  return out;
}

async function read(userId: string): Promise<NotificationPreferences> {
  const { rows } = await dbPool.query<{ notification_preferences: unknown }>(
    'SELECT notification_preferences FROM user_settings WHERE user_id = $1',
    [userId],
  );
  const stored = rows[0]?.notification_preferences;
  // Merged over defaults so a partially-saved object still returns every field.
  return { ...DEFAULTS, ...(typeof stored === 'object' && stored ? stored : {}) };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    return jsonResponse({ preferences: await read(user.userId) });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to load notification preferences', 500),
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth(request);
    const patch = validate(await request.json().catch(() => null));

    // Read-merge-write so a PATCH of one field cannot silently clear the rest.
    const merged = { ...(await read(user.userId)), ...patch };

    await dbPool.query(
      `INSERT INTO user_settings (user_id, notification_preferences)
       VALUES ($1::varchar, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET notification_preferences = EXCLUDED.notification_preferences`,
      [user.userId, JSON.stringify(merged)],
    );

    return jsonResponse({ preferences: merged });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to save notification preferences', 500),
    );
  }
}
