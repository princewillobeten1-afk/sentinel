import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { apiKeyStore } from '@/lib/server/api-keys';
import { SCOPES, ScopeGrantError } from '@/lib/server/scopes';
import { RATE_LIMIT_TIERS } from '@/lib/server/rate-limit-v2';

export const dynamic = 'force-dynamic';

/**
 * API key management is the platform's own control plane, so it stays on
 * session auth (`requireAuth`) rather than going through the API-key
 * gateway — a key must never be able to mint another key, which would let a
 * leaked read-only key escalate itself into a trading key (spec §95).
 */

const createKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(SCOPES)).default([]),
  environment: z.enum(['production', 'sandbox']).default('sandbox'),
  tier: z.enum(RATE_LIMIT_TIERS).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const keys = apiKeyStore.listForUser(user.userId);
    return jsonResponse({ keys, count: keys.length });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to list API keys', 500));
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(createKeySchema, payload);

    const { key, secret } = apiKeyStore.create(user.userId, {
      name: data.name,
      scopes: [...data.scopes],
      environment: data.environment,
      tier: data.tier,
      expiresAt: data.expiresAt ?? null,
    });

    return jsonResponse(
      {
        key,
        secret,
        notice: 'Store this secret now — it is shown only once and cannot be retrieved later.',
      },
      201,
    );
  } catch (error) {
    if (error instanceof ScopeGrantError) {
      return errorResponse(new ApiError(error.message, 400, 'INVALID_SCOPE_COMBINATION'));
    }
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to create API key', 500));
  }
}
