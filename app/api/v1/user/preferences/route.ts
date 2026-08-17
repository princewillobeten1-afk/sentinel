import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { serverStore } from '@/lib/server/store';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const updatePreferencesSchema = z.object({
  slippageTolerance: z.number().min(0.01).max(50.0).optional(),
  riskLevel: z.enum(['conservative', 'moderate', 'high', 'degenerate']).optional(),
  currencyDisplay: z.enum(['USD', 'SOL', 'EUR', 'BTC']).optional(),
  rpcEndpoint: z.enum(['mainnet', 'devnet', 'custom']).optional(),
  customRpcUrl: z.string().optional().nullable(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
  density: z.enum(['compact', 'standard', 'spacious']).optional(),
  autoLockMinutes: z.number().min(0).max(1440).optional(),
  notificationsEnabled: z
    .object({
      security: z.boolean().optional(),
      priceAlerts: z.boolean().optional(),
      tradeExecution: z.boolean().optional(),
      system: z.boolean().optional(),
    })
    .optional(),
});

export async function GET(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const preferences = await serverStore.getUserPreferences(authUser.userId);
    return jsonResponse({ preferences });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch preferences', 500));
  }
}

export async function PUT(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(updatePreferencesSchema, payload);

    const updatedPreferences = await serverStore.updateUserPreferences(authUser.userId, data);

    return jsonResponse({
      preferences: updatedPreferences,
      message: 'Account preferences updated.',
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update preferences', 500));
  }
}
