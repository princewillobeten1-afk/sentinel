import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),query:vi.fn(),redis:vi.fn()}));
vi.mock('@/lib/server/auth',()=>({requireAuth:mocks.auth,getBearerToken:()=> 'test.signed.session'}));
vi.mock('@/lib/server/db/pool',()=>({dbPool:{query:mocks.query}}));
vi.mock('@/lib/server/redis',()=>({redis:{evalStrict:mocks.redis}}));
import { requirePilotUser, pilotConfig, pilotSetupIssues } from '../pilot/config';
import { getTurns, deleteSession, saveTurn, recordUsage } from '../pilot/repository';
import { reserveAnswer, reserveModelCall } from '../pilot/quota';
import type { SavedTurn } from '../pilot/contracts';

beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('AI_COPILOT_ACCESS','invited');vi.stubEnv('AI_PILOT_USER_IDS','invited');mocks.auth.mockResolvedValue({userId:'invited',roles:['user']});});
afterEach(()=>vi.unstubAllEnvs());
it('requires authentication',async()=>{mocks.auth.mockRejectedValue(new Error('unauthenticated'));await expect(requirePilotUser(new Request('http://localhost'))).rejects.toThrow();});
it('denies even administrators not explicitly invited',async()=>{mocks.auth.mockResolvedValue({userId:'admin',roles:['admin']});await expect(requirePilotUser(new Request('http://localhost'))).rejects.toMatchObject({code:'AI_ACCESS_REQUIRED'});});
it('permits an authenticated invited tester',async()=>expect(await requirePilotUser(new Request('http://localhost'))).toMatchObject({userId:'invited'}));
it('can open access to all signed-in accounts without an allowlist',async()=>{vi.stubEnv('AI_COPILOT_ACCESS','authenticated');mocks.auth.mockResolvedValue({userId:'public-user',role:'user'});expect(await requirePilotUser(new Request('http://localhost'))).toMatchObject({userId:'public-user'});});
it('unknown access modes do not bypass invitations',async()=>{vi.stubEnv('AI_COPILOT_ACCESS','anonymous');mocks.auth.mockResolvedValue({userId:'unknown',role:'user'});await expect(requirePilotUser(new Request('http://localhost'))).rejects.toMatchObject({code:'AI_ACCESS_REQUIRED'});});
it('does not enable free-tier calls without explicit limits and confirmation',()=>{vi.stubEnv('AI_FREE_TIER_CONFIRMED','false');expect(pilotConfig().success).toBe(false);});
it('identifies missing setup categories without exposing model credentials',()=>{
  vi.stubEnv('GEMINI_API_KEY','private-test-key');
  vi.stubEnv('AI_PILOT_ENABLED','true');
  vi.stubEnv('AI_FREE_TIER_CONFIRMED','true');
  vi.stubEnv('AI_MODEL_RPM',''); vi.stubEnv('AI_MODEL_TPM',''); vi.stubEnv('AI_MODEL_RPD','');
  vi.stubEnv('DATABASE_URL','postgres://private-test'); vi.stubEnv('REDIS_URL','redis://private-test');
  expect(pilotSetupIssues()).toEqual(['rate_limits']);
  expect(JSON.stringify(pilotSetupIssues())).not.toContain('private-test');
});
it('enables the pilot only when activation, limits, and storage are configured',()=>{
  for (const [key,value] of Object.entries({GEMINI_API_KEY:'private-test-key',AI_PILOT_ENABLED:'true',
    AI_FREE_TIER_CONFIRMED:'true',AI_MODEL_RPM:'5',AI_MODEL_TPM:'250000',AI_MODEL_RPD:'20',
    DATABASE_URL:'postgres://private-test',REDIS_URL:'redis://private-test'})) vi.stubEnv(key,value);
  expect(pilotSetupIssues()).toEqual([]);
  expect(pilotConfig().success).toBe(true);
});
it('does not fall back to in-memory quotas',async()=>{mocks.redis.mockRejectedValue(new Error('down'));await expect(reserveAnswer('u','r')).rejects.toMatchObject({code:'AI_COORDINATION_UNAVAILABLE'});});
it.each([['duplicate','AI_DUPLICATE_REQUEST'],['busy','AI_BUSY'],['quota','AI_QUOTA_EXHAUSTED']])('handles Redis %s',async(state,code)=>{mocks.redis.mockResolvedValue(state);await expect(reserveAnswer('u','r')).rejects.toMatchObject({code});});
it('atomically reserves and releases its own project lease',async()=>{mocks.redis.mockResolvedValue('ok');const release=await reserveAnswer('u','r');await release();expect(mocks.redis.mock.calls[1][0]).toContain("== ARGV[1]");});
it('enforces RPM/TPM/RPD before a model call',async()=>{mocks.redis.mockResolvedValue(0);await expect(reserveModelCall('model',1000,{rpm:1,tpm:500,rpd:5})).rejects.toMatchObject({code:'AI_QUOTA_EXHAUSTED'});});
it('isolates conversation reads by owner',async()=>{mocks.query.mockResolvedValue({rows:[]});await expect(getTurns('other-user','private-session')).rejects.toMatchObject({code:'AI_SESSION_NOT_FOUND'});expect(mocks.query).toHaveBeenCalledTimes(1);expect(mocks.query.mock.calls[0][1]).toEqual(['private-session','other-user']);});
it('scopes deletion to authenticated owner',async()=>{mocks.query.mockResolvedValue({rows:[]});await deleteSession('owner','session');expect(mocks.query.mock.calls[0][0]).toContain('user_id=$2');expect(mocks.query.mock.calls[0][1]).toEqual(['session','owner']);});
it('rechecks ownership on save so deletion cannot recreate conversation',async()=>{mocks.query.mockResolvedValue({rows:[]});await saveTurn('owner','session',{id:'turn',question:'Public question',context:{page:'ai'},facts:[],answer:{sections:[],validated:false}} as unknown as SavedTurn);expect(mocks.query.mock.calls[0][0]).toContain('user_id=$3 AND expires_at>NOW()');});
it('stores no simulated confidence score',async()=>{mocks.query.mockResolvedValue({rows:[]});await recordUsage({id:'request',model:'model',input:10,output:2,thinking:3,latency:100,tools:[],status:'complete'});expect(mocks.query.mock.calls[0][0]).toContain('FALSE,NULL');expect(mocks.query.mock.calls[0][1][2]).toBe(15);});
