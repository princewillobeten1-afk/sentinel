import 'server-only';
import { pruneExpired } from './repository';
import { logger } from '@/lib/server/logger';

const globalPilot = globalThis as unknown as { copilotRetentionTimer?: ReturnType<typeof setInterval> };
/** Custom server bootstrap; no AI calls or credentials are used for retention. */
export function startCopilotRetention() {
  if (!process.env.DATABASE_URL || globalPilot.copilotRetentionTimer) return;
  const sweep = () => void pruneExpired().catch(() => logger.warn('[ai-pilot] retention sweep unavailable'));
  sweep();
  globalPilot.copilotRetentionTimer = setInterval(sweep, 60 * 60 * 1000);
  globalPilot.copilotRetentionTimer.unref?.();
}
