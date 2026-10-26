import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, getBearerToken, getClientIp, type AuthUser } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

const schema = z.object({
  key: z.string().min(1),
  model: z.string().regex(/^[a-zA-Z0-9_./-]+$/),
  baseURL: z.string().url().default('https://integrate.api.nvidia.com/v1'),
  enabled: z.literal('true'),
  freeConfirmed: z.literal('true'),
  rpm: z.coerce.number().int().positive(),
  tpm: z.coerce.number().int().positive(),
  rpd: z.coerce.number().int().positive(),
});
export function pilotConfig() {
  const key = process.env.NVIDIA_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL?.trim() || (process.env.GEMINI_MODEL ? process.env.GEMINI_MODEL.trim() : 'nvidia/nemotron-3.5-super-vl-120b-a12b');
  const baseURL = process.env.NVIDIA_BASE_URL?.trim() || 'https://integrate.api.nvidia.com/v1';

  return schema.safeParse({
    key,
    model,
    baseURL,
    enabled: process.env.AI_PILOT_ENABLED,
    freeConfirmed: process.env.AI_FREE_TIER_CONFIRMED,
    rpm: process.env.AI_MODEL_RPM,
    tpm: process.env.AI_MODEL_TPM,
    rpd: process.env.AI_MODEL_RPD,
  });
}
export type PilotSetupIssue = 'pilot_disabled' | 'free_tier_unconfirmed' | 'model_access' | 'rate_limits' | 'storage';
export function pilotSetupIssues(): PilotSetupIssue[] {
  const issues = new Set<PilotSetupIssue>();
  const config = pilotConfig();
  if (!config.success) {
    for (const issue of config.error.issues) {
      switch (issue.path[0]) {
        case 'enabled': issues.add('pilot_disabled'); break;
        case 'freeConfirmed': issues.add('free_tier_unconfirmed'); break;
        case 'rpm': case 'tpm': case 'rpd': issues.add('rate_limits'); break;
        default: issues.add('model_access');
      }
    }
  }
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) issues.add('storage');
  return [...issues];
}
export function isPilotOpen(): boolean {
  const access = process.env.AI_COPILOT_ACCESS?.trim().toLowerCase();
  return access === 'open' || access === 'public';
}
export function isPilotUser(user: AuthUser): boolean {
  if (isPilotOpen()) return true;
  if (process.env.AI_COPILOT_ACCESS === 'authenticated') return true;
  return (process.env.AI_PILOT_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean).includes(user.userId);
}
function extractClientIp(req: Request): string {
  try {
    const ip = getClientIp(req);
    if (ip) return ip;
  } catch {}
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anon';
}
export async function requirePilotUser(req: Request, requireConfigured = false): Promise<AuthUser> {
  if (requireConfigured && pilotSetupIssues().length > 0) {
    throw new ApiError('Copilot setup is not complete. No AI request has been sent.', 503, 'AI_NOT_CONFIGURED');
  }

  const token = getBearerToken(req);

  // If a valid JWT bearer token is present, authenticate the user
  if (token && token.split('.').length === 3) {
    try {
      const user = await requireAuth(req);
      if (!isPilotUser(user)) throw new ApiError('Copilot is available to invited testers only.', 403, 'AI_ACCESS_REQUIRED');
      return user;
    } catch (authErr) {
      if (!isPilotOpen()) throw authErr;
    }
  }

  // Legacy dev convenience tokens or malformed bearer tokens must never unlock external AI usage.
  if (token && !isPilotOpen()) throw new ApiError('Sign in to use Copilot.', 401, 'AUTH_REQUIRED');

  // When unauthenticated: check if open access is permitted without signing in
  if (isPilotOpen()) {
    const guestHeader = req.headers.get('x-guest-id') || req.headers.get('x-sentinel-guest-id');
    const guestId = (guestHeader && /^guest_[a-zA-Z0-9_-]{6,64}$/.test(guestHeader))
      ? guestHeader
      : `guest_${createHash('sha256').update(extractClientIp(req)).digest('hex').slice(0, 16)}`;

    return {
      userId: guestId,
      role: 'guest',
      email: 'guest@sentinel.local',
      displayName: 'Guest Trader',
    } as unknown as AuthUser;
  }

  throw new ApiError('Sign in to use Copilot.', 401, 'AUTH_REQUIRED');
}
