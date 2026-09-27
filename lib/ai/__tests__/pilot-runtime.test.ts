import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({generate:vi.fn(),tool:vi.fn(),getTurns:vi.fn(),save:vi.fn(),usage:vi.fn(),reserve:vi.fn(),pause:vi.fn()}));
vi.mock('@google/genai',()=>({GoogleGenAI:class{models={generateContent:mocks.generate};}}));
vi.mock('../pilot/tools',()=>({executeSkill:mocks.tool}));
vi.mock('../pilot/repository',()=>({getTurns:mocks.getTurns,saveTurn:mocks.save,recordUsage:mocks.usage}));
vi.mock('../pilot/quota',()=>({reserveModelCall:mocks.reserve,pauseModel:mocks.pause}));
vi.mock('@/lib/server/logger',()=>({logger:{warn:vi.fn()}}));
import { runPilot, modelHistory, retryDelay } from '../pilot/runtime';
import { fact } from '../pilot/evidence';
import { buildInsights } from '../pilot/insights';
import type { PilotEvent, PilotRequest, SavedTurn } from '../pilot/contracts';

const mint='So11111111111111111111111111111111111111112';
const request:PilotRequest={requestId:crypto.randomUUID(),question:'Assess this token',context:{page:'trade',chain:'solana',mint,timeframe:'1m',displayUnit:'price'},privacyAccepted:true};
const measured=fact({mint,metric:'price',label:'Price',value:1,unit:'USD',category:'market'}, {status:'measured',source:'private-integration-name',observedAt:new Date().toISOString()});
beforeEach(()=>{
  vi.resetAllMocks();
  Object.entries({GEMINI_API_KEY:'test-key-not-real',AI_PILOT_ENABLED:'true',AI_FREE_TIER_CONFIRMED:'true',AI_MODEL_RPM:'30',AI_MODEL_TPM:'100000',AI_MODEL_RPD:'500'}).forEach(([k,v])=>vi.stubEnv(k,v));
  mocks.getTurns.mockResolvedValue([]);mocks.save.mockResolvedValue(undefined);mocks.usage.mockResolvedValue(undefined);mocks.reserve.mockResolvedValue(undefined);mocks.pause.mockResolvedValue(undefined);
  mocks.tool.mockResolvedValue({facts:[measured],notes:[]});
});
afterEach(()=>vi.unstubAllEnvs());
const call=(names=['token_assessment'])=>({functionCalls:names.map((name,i)=>({name,id:String(i),args:{mint}})),candidates:[{content:{role:'model',parts:[{functionCall:{name:names[0],args:{mint}},thoughtSignature:'signature-must-survive'}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:2,thoughtsTokenCount:3}});
const answer=()=>({text:JSON.stringify({insightIds:[buildInsights([measured]).find(i=>i.title==='Overview')!.id]}),usageMetadata:{promptTokenCount:20,candidatesTokenCount:4,thoughtsTokenCount:5}});
it('executes a real SDK tool loop, retains thought signatures, and records actual usage',async()=>{
  mocks.generate.mockResolvedValueOnce(call()).mockResolvedValueOnce(answer());const events:PilotEvent[]=[];
  await runPilot('private-user','session',request,new AbortController().signal,e=>events.push(e));
  expect(mocks.tool).toHaveBeenCalledWith('token_assessment',{mint},expect.any(AbortSignal));
  const outbound=mocks.generate.mock.calls[1][0];
  expect(JSON.stringify(outbound.contents)).toContain('signature-must-survive');
  expect(JSON.stringify(outbound)).not.toContain('private-user');
  expect(JSON.stringify(events)).not.toMatch(/private-integration-name|test-key-not-real|signature-must-survive/);
  expect(events.some(e=>e.type==='answer' && e.answer.validated)).toBe(true);
  expect(mocks.usage).toHaveBeenCalledWith(expect.objectContaining({input:30,output:6,thinking:8,status:'complete'}));
});
it.each(['Buy 0.5 SOL','My wallet balance is 10','Analyze my trading history','password=secret'])('blocks %s before outbound calls',async question=>{
  await expect(runPilot('u','s',{...request,question},new AbortController().signal,()=>undefined)).rejects.toMatchObject({code:'AI_PUBLIC_DATA_ONLY'});
  expect(mocks.generate).not.toHaveBeenCalled();
});
it('keeps evidence but rejects fabricated responses',async()=>{
  mocks.generate.mockResolvedValueOnce(call()).mockResolvedValueOnce({text:'{"insightIds":["fake"]}'});const events:PilotEvent[]=[];
  await runPilot('u','s',request,new AbortController().signal,e=>events.push(e));
  expect(events.some(e=>e.type==='evidence' && e.facts[0].value===1)).toBe(true);
  expect(events.some(e=>e.type==='answer' && !e.answer.validated)).toBe(true);
});
it('never exceeds four model rounds',async()=>{
  mocks.generate.mockImplementation(async()=>call());
  await runPilot('u','s',request,new AbortController().signal,()=>undefined);
  expect(mocks.generate).toHaveBeenCalledTimes(4);expect(mocks.generate.mock.calls[3][0].config.tools).toBeUndefined();
});
it('rejects a batch beyond eight tool calls',async()=>{
  mocks.generate.mockResolvedValue(call(Array(9).fill('token_assessment')));
  await runPilot('u','s',request,new AbortController().signal,()=>undefined);expect(mocks.tool).not.toHaveBeenCalled();
});
it('memoizes duplicate tool arguments within the answer',async()=>{
  mocks.generate.mockResolvedValueOnce(call(['token_assessment','token_assessment'])).mockResolvedValueOnce(answer());
  await runPilot('u','s',request,new AbortController().signal,()=>undefined);expect(mocks.tool).toHaveBeenCalledTimes(1);
});
it('stops without retries or fallback on quota exhaustion',async()=>{
  mocks.generate.mockRejectedValue({status:429,message:'{"retryDelay":"125s"} credential=https://secret.invalid'});const events:PilotEvent[]=[];
  await runPilot('u','s',request,new AbortController().signal,e=>events.push(e));
  expect(mocks.generate).toHaveBeenCalledTimes(1);expect(mocks.pause).toHaveBeenCalledWith(125);
  expect(JSON.stringify(events)).not.toContain('secret.invalid');
  expect(events.some(e=>e.type==='error' && e.code==='AI_QUOTA_EXHAUSTED')).toBe(true);
});
it('does not call the model after cancellation',async()=>{
  const controller=new AbortController();controller.abort();
  await runPilot('u','s',request,controller.signal,()=>undefined);
  expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it('stops before another model round on cancellation during a tool',async()=>{
  const controller=new AbortController();mocks.generate.mockResolvedValue(call());
  mocks.tool.mockImplementation(async()=>{controller.abort();return {facts:[measured],notes:[]};});
  await runPilot('u','s',request,controller.signal,()=>undefined);
  expect(mocks.generate).toHaveBeenCalledTimes(1);expect(mocks.save).not.toHaveBeenCalled();
});
it('does not call the model when Redis budget reservation fails',async()=>{
  mocks.reserve.mockRejectedValue(new Error('redis unavailable'));
  await runPilot('u','s',request,new AbortController().signal,()=>undefined);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it('keeps old private history outside Gemini and retains public context',()=>{
  const turn={...request,id:'id',facts:[],answer:{validated:true,sections:[]},createdAt:new Date().toISOString()} as SavedTurn;
  expect(modelHistory([{...turn,question:'My wallet is ABC'}])).toEqual([]);
  expect(JSON.stringify(modelHistory([turn]))).toContain(mint);
});
it('honors Retry-After headers',()=>expect(retryDelay({response:{headers:new Headers({'retry-after':'600'})}})).toBe(600));
it('uses a bounded pause if no retry guidance exists',()=>expect(retryDelay({})).toBe(3600));
