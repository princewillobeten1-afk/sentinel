import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { redis } from '@/lib/server/redis';
import { ApiError } from '@/lib/server/errors';

const prefix = 'sentinel:ai:pilot:';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
// Shared by every model request and every process; no local fallback allowed.
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
export async function reserveAnswer(userId: string, requestId: string) {
  const owner = randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  let result;
  try {
    result = await redis.evalStrict(RESERVE, [prefix + 'request:' + hash(userId + ':' + requestId), prefix + 'active',
      prefix + 'user:' + hash(userId) + ':' + day, prefix + 'day:' + day, prefix + 'pause'], [owner]);
  } catch { throw new ApiError('Copilot coordination is temporarily unavailable. Please retry shortly.', 503, 'AI_COORDINATION_UNAVAILABLE'); }
  if (result !== 'ok') throw new ApiError(result === 'duplicate' ? 'This request was already accepted. Open its conversation instead of resending.'
    : result === 'busy' ? 'Copilot is handling another request. Please retry shortly.' : 'The pilot usage limit has been reached. Please try later.',
  429, result === 'duplicate' ? 'AI_DUPLICATE_REQUEST' : result === 'busy' ? 'AI_BUSY' : 'AI_QUOTA_EXHAUSTED');
  return async () => {
    await redis.evalStrict("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", [prefix + 'active'], [owner]);
  };
}
export async function reserveModelCall(model: string, tokenUpperBound: number, limits: { rpm: number; tpm: number; rpd: number }) {
  const minute = Math.floor(Date.now() / 60000);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const ok = await redis.evalStrict(COUNTER_SCRIPT,
    [prefix + model + ':rpm:' + minute, prefix + model + ':tpm:' + minute, prefix + model + ':rpd:' + day],
    [1, limits.rpm, 120, tokenUpperBound, limits.tpm, 120, 1, limits.rpd, 172800]);
  if (ok !== 1) throw new ApiError('The AI request quota is currently exhausted. Existing evidence is still available.', 429, 'AI_QUOTA_EXHAUSTED');
}
export async function pauseModel(seconds: number) {
  await redis.evalStrict("return redis.call('SET',KEYS[1],'1','EX',ARGV[1])", [prefix + 'pause'], [Math.ceil(Math.min(86400, Math.max(60, seconds)))]);
}
