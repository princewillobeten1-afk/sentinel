import 'server-only';
import { z } from 'zod';
import { requireAuth, getBearerToken, type AuthUser } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

const schema = z.object({
  key: z.string().min(1), model: z.string().regex(/^gemini-[a-z0-9.-]+$/),
  enabled: z.literal('true'), freeConfirmed: z.literal('true'),
  rpm: z.coerce.number().int().positive(), tpm: z.coerce.number().int().positive(), rpd: z.coerce.number().int().positive(),
});
export function pilotConfig() {
  return schema.safeParse({ key: process.env.GEMINI_API_KEY?.trim(), model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    enabled: process.env.AI_PILOT_ENABLED, freeConfirmed: process.env.AI_FREE_TIER_CONFIRMED,
    rpm: process.env.AI_MODEL_RPM, tpm: process.env.AI_MODEL_TPM, rpd: process.env.AI_MODEL_RPD });
}
export function isPilotUser(user: AuthUser): boolean {
  // Public access still means an authenticated account: conversations remain private.
  if (process.env.AI_COPILOT_ACCESS === 'authenticated') return true;
  return (process.env.AI_PILOT_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean).includes(user.userId);
}
export async function requirePilotUser(req: Request, requireConfigured = false) {
  // Legacy dev convenience tokens must never unlock external AI usage.
  if (getBearerToken(req)?.split('.').length !== 3) throw new ApiError('Sign in to use Copilot.',401,'AUTH_REQUIRED');
  const user = await requireAuth(req);
  if (!isPilotUser(user)) throw new ApiError('Copilot is available to invited testers only.', 403, 'AI_ACCESS_REQUIRED');
  if (requireConfigured && (!pilotConfig().success || !process.env.DATABASE_URL || !process.env.REDIS_URL)) {
    throw new ApiError('Copilot setup is not complete. No AI request has been sent.', 503, 'AI_NOT_CONFIGURED');
  }
  return user;
}
