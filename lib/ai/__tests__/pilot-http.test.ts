import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),open:vi.fn(),reserve:vi.fn(),release:vi.fn(),run:vi.fn()}));
vi.mock('../pilot/config',()=>({requirePilotUser:mocks.auth}));
vi.mock('../pilot/repository',()=>({openSession:mocks.open}));
vi.mock('../pilot/quota',()=>({reserveAnswer:mocks.reserve}));
vi.mock('../pilot/runtime',()=>({runPilot:mocks.run}));
import { copilotPost } from '../pilot/http';
import { ApiError } from '@/lib/server/errors';
const body=()=>({requestId:crypto.randomUUID(),question:'Analyze this chart',context:{page:'trade',chain:'solana',mint:'So11111111111111111111111111111111111111112',timeframe:'1m',displayUnit:'price'},privacyAccepted:true});
const req=(value:unknown=body())=>new Request('http://localhost/api/v1/ai/copilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({userId:'owner'});mocks.open.mockResolvedValue('session');mocks.reserve.mockResolvedValue(mocks.release);mocks.release.mockResolvedValue(undefined);mocks.run.mockResolvedValue(undefined);});
afterEach(()=>vi.useRealTimers());
it('enforces authentication before storage or model calls',async()=>{mocks.auth.mockRejectedValue(new ApiError('Sign in',401,'AUTH_REQUIRED'));expect((await copilotPost(req())).status).toBe(401);expect(mocks.open).not.toHaveBeenCalled();expect(mocks.run).not.toHaveBeenCalled();});
it.each([{...body(),privacyAccepted:false},{...body(),messages:[]},{...body(),context:{chain:'ethereum'}},{...body(),question:'Buy 0.25 SOL'}])('blocks invalid or private request before storage: %j',async input=>{expect((await copilotPost(req(input))).status).toBe(400);expect(mocks.open).not.toHaveBeenCalled();expect(mocks.run).not.toHaveBeenCalled();});
it('bounds the input body before parsing',async()=>{expect((await copilotPost(req({question:'x'.repeat(8100)}))).status).toBe(413);expect(mocks.run).not.toHaveBeenCalled();});
it('does not run when distributed coordination fails',async()=>{mocks.reserve.mockRejectedValue(new ApiError('Unavailable',503,'AI_COORDINATION_UNAVAILABLE'));expect((await copilotPost(req())).status).toBe(503);expect(mocks.run).not.toHaveBeenCalled();});
it('returns typed SSE with no caching',async()=>{
  mocks.run.mockImplementation(async(_u,_s,_r,_signal,emit)=>emit({type:'done',requestId:'id'}));
  const response=await copilotPost(req());expect(response.headers.get('Content-Type')).toBe('text/event-stream');expect(response.headers.get('Cache-Control')).toContain('no-store');expect(await response.text()).toContain('"type":"done"');
});
it('aborts work and releases the project lease on client cancellation',async()=>{
  let signal:AbortSignal|undefined;
  mocks.run.mockImplementation((_u,_s,_r,s:AbortSignal)=>{signal=s;return new Promise<void>(resolve=>s.addEventListener('abort',()=>resolve()));});
  const response=await copilotPost(req());await response.body!.cancel();await new Promise(resolve=>setTimeout(resolve,0));
  expect(signal?.aborted).toBe(true);expect(mocks.release).toHaveBeenCalledTimes(1);
});
it('enforces the generation deadline without exposing an upstream error',async()=>{
  vi.useFakeTimers();mocks.run.mockImplementation((_u,_s,_r,s:AbortSignal)=>new Promise<void>(resolve=>s.addEventListener('abort',()=>resolve())));
  const response=await copilotPost(req());const result=response.text();await vi.advanceTimersByTimeAsync(45001);
  expect(await result).toContain('AI_DEADLINE');expect(mocks.release).toHaveBeenCalledTimes(1);
});
