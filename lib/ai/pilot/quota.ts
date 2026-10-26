import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { redis } from '@/lib/server/redis';
import { ApiError } from '@/lib/server/errors';

const prefix = 'sentinel:ai:pilot:';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

// In-memory fallback tracking when Redis is offline or unreachable
interface QuotaRecord {
  count: number;
  expiresAt: number;
}

const globalForPilotQuota = globalThis as unknown as {
  __sentinelCopilotQuota?: {
    seenRequests: Map<string, number>;
    activeLock: { owner: string; expiresAt: number } | null;
    userDayCounts: Map<string, QuotaRecord>;
    projectDayCounts: Map<string, QuotaRecord>;
    pauseUntil: number;
    rpmCounts: Map<string, QuotaRecord>;
    tpmCounts: Map<string, QuotaRecord>;
    rpdCounts: Map<string, QuotaRecord>;
  };
};

const memoryQuota = globalForPilotQuota.__sentinelCopilotQuota ?? {
  seenRequests: new Map<string, number>(),
  activeLock: null as { owner: string; expiresAt: number } | null,
  userDayCounts: new Map<string, QuotaRecord>(),
  projectDayCounts: new Map<string, QuotaRecord>(),
  pauseUntil: 0,
  rpmCounts: new Map<string, QuotaRecord>(),
  tpmCounts: new Map<string, QuotaRecord>(),
  rpdCounts: new Map<string, QuotaRecord>(),
};

if (process.env.NODE_ENV !== 'production') {
  globalForPilotQuota.__sentinelCopilotQuota = memoryQuota;
}

function reserveAnswerInMemory(userId: string, requestId: string, owner: string, day: string): string {
  const now = Date.now();
  const reqKey = hash(userId + ':' + requestId);
  const userKey = hash(userId) + ':' + day;

  if (memoryQuota.activeLock && memoryQuota.activeLock.expiresAt <= now) {
    memoryQuota.activeLock = null;
  }
  for (const [k, exp] of memoryQuota.seenRequests) {
    if (exp <= now) memoryQuota.seenRequests.delete(k);
  }

  if (memoryQuota.seenRequests.has(reqKey)) return 'duplicate';
  if (memoryQuota.activeLock && memoryQuota.activeLock.expiresAt > now) return 'busy';
  if (memoryQuota.pauseUntil > now) return 'quota';

  const userRecord = memoryQuota.userDayCounts.get(userKey);
  if (userRecord && userRecord.expiresAt > now && userRecord.count >= 10) return 'quota';

  const projRecord = memoryQuota.projectDayCounts.get(day);
  if (projRecord && projRecord.expiresAt > now && projRecord.count >= 20) return 'quota';

  memoryQuota.seenRequests.set(reqKey, now + 86400 * 1000);
  memoryQuota.activeLock = { owner, expiresAt: now + 90 * 1000 };

  const currentU = userRecord && userRecord.expiresAt > now ? userRecord.count : 0;
  memoryQuota.userDayCounts.set(userKey, { count: currentU + 1, expiresAt: now + 172800 * 1000 });

  const currentP = projRecord && projRecord.expiresAt > now ? projRecord.count : 0;
  memoryQuota.projectDayCounts.set(day, { count: currentP + 1, expiresAt: now + 172800 * 1000 });

  return 'ok';
}

// Shared by every model request and every process; falls back to in-memory coordination when Redis is unavailable.
export const COUNTER_SCRIPT = `
for i=1,#KEYS do
 if tonumber(redis.call('GET',KEYS[i]) or '0') + tonumber(ARGV[i*3-2]) > tonumber(ARGV[i*3-1]) then return 0 end
end
for i=1,#KEYS do redis.call('INCRBY',KEYS[i],ARGV[i*3-2]); redis.call('EXPIRE',KEYS[i],ARGV[i*3]) end
return 1`;

const RESERVE = `
if redis.call('EXISTS',KEYS[1]) == 1 then return 'duplicate' end
if redis.call('EXISTS',KEYS[2]) == 1 then return 'busy' end
if redis.call('EXISTS',KEYS[5]) == 1 then return 'quota' end
if tonumber(redis.call('GET',KEYS[3]) or '0') >= 10 or tonumber(redis.call('GET',KEYS[4]) or '0') >= 20 then return 'quota' end
redis.call('SET',KEYS[1],ARGV[1],'EX',86400)
redis.call('SET',KEYS[2],ARGV[1],'EX',90)
for i=3,4 do redis.call('INCR',KEYS[i]); redis.call('EXPIRE',KEYS[i],172800) end
return 'ok'`;

function isRedisConnectionError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as any)?.code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ECONNRESET' ||
    /connection refused|connect ECONNREFUSED|Distributed coordination is unavailable|socket closed|stream was destroyed/i.test(msg)
  );
}

export async function reserveAnswer(userId: string, requestId: string) {
  const owner = randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  let result: unknown;

  try {
    result = await redis.evalStrict(RESERVE, [
      prefix + 'request:' + hash(userId + ':' + requestId),
      prefix + 'active',
      prefix + 'user:' + hash(userId) + ':' + day,
      prefix + 'day:' + day,
      prefix + 'pause',
    ], [owner]);
  } catch (err) {
    if (isRedisConnectionError(err) && process.env.NODE_ENV !== 'test') {
      result = reserveAnswerInMemory(userId, requestId, owner, day);
    } else {
      throw new ApiError('Distributed coordination is unavailable', 503, 'AI_COORDINATION_UNAVAILABLE');
    }
  }

  if (result !== 'ok') {
    throw new ApiError(
      result === 'duplicate'
        ? 'This request was already accepted. Open its conversation instead of resending.'
        : result === 'busy'
        ? 'Copilot is handling another request. Please retry shortly.'
        : 'The pilot usage limit has been reached. Please try later.',
      429,
      result === 'duplicate' ? 'AI_DUPLICATE_REQUEST' : result === 'busy' ? 'AI_BUSY' : 'AI_QUOTA_EXHAUSTED'
    );
  }

  return async () => {
    try {
      await redis.evalStrict(
        "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
        [prefix + 'active'],
        [owner]
      );
    } catch (err) {
      if (isRedisConnectionError(err) && process.env.NODE_ENV !== 'test') {
        if (memoryQuota.activeLock?.owner === owner) {
          memoryQuota.activeLock = null;
        }
      }
    }
  };
}

export async function reserveModelCall(model: string, tokenUpperBound: number, limits: { rpm: number; tpm: number; rpd: number }) {
  const minute = Math.floor(Date.now() / 60000);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  try {
    const ok = await redis.evalStrict(
      COUNTER_SCRIPT,
      [prefix + model + ':rpm:' + minute, prefix + model + ':tpm:' + minute, prefix + model + ':rpd:' + day],
      [1, limits.rpm, 120, tokenUpperBound, limits.tpm, 120, 1, limits.rpd, 172800]
    );
    if (ok !== 1) throw new ApiError('The AI request quota is currently exhausted. Existing evidence is still available.', 429, 'AI_QUOTA_EXHAUSTED');
    return;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (!isRedisConnectionError(err) || process.env.NODE_ENV === 'test') {
      throw err;
    }
  }

  const now = Date.now();
  const rpmKey = `${model}:rpm:${minute}`;
  const tpmKey = `${model}:tpm:${minute}`;
  const rpdKey = `${model}:rpd:${day}`;

  const currentRpm = memoryQuota.rpmCounts.get(rpmKey);
  const currentTpm = memoryQuota.tpmCounts.get(tpmKey);
  const currentRpd = memoryQuota.rpdCounts.get(rpdKey);

  const rpmVal = currentRpm && currentRpm.expiresAt > now ? currentRpm.count : 0;
  const tpmVal = currentTpm && currentTpm.expiresAt > now ? currentTpm.count : 0;
  const rpdVal = currentRpd && currentRpd.expiresAt > now ? currentRpd.count : 0;

  if (rpmVal + 1 > limits.rpm || tpmVal + tokenUpperBound > limits.tpm || rpdVal + 1 > limits.rpd) {
    throw new ApiError('The AI request quota is currently exhausted. Existing evidence is still available.', 429, 'AI_QUOTA_EXHAUSTED');
  }

  memoryQuota.rpmCounts.set(rpmKey, { count: rpmVal + 1, expiresAt: now + 120 * 1000 });
  memoryQuota.tpmCounts.set(tpmKey, { count: tpmVal + tokenUpperBound, expiresAt: now + 120 * 1000 });
  memoryQuota.rpdCounts.set(rpdKey, { count: rpdVal + 1, expiresAt: now + 172800 * 1000 });
}

export async function pauseModel(seconds: number) {
  const duration = Math.ceil(Math.min(86400, Math.max(60, seconds)));
  memoryQuota.pauseUntil = Math.max(memoryQuota.pauseUntil, Date.now() + duration * 1000);
  try {
    await redis.evalStrict("return redis.call('SET',KEYS[1],'1','EX',ARGV[1])", [prefix + 'pause'], [duration]);
  } catch {}
}
