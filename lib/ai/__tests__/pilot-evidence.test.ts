import { describe, expect, it, vi, afterEach } from 'vitest';
import { fact, numeric, chartFacts, changedFacts, validateAnswer } from '../pilot/evidence';
import { buildInsights, resolveSelection } from '../pilot/insights';
import { privacyViolation } from '../pilot/privacy';
import { contextSchema, requestSchema } from '../pilot/contracts';
import { skills } from '../pilot/skills';
import type { ChartSnapshot } from '@/lib/market/chart-model';

const mint='So11111111111111111111111111111111111111112';
const at=Date.parse('2026-09-27T12:00:00Z');
const evidence={status:'measured' as const,source:'internal-test',observedAt:new Date(at).toISOString(),expiresAt:new Date(at+60000).toISOString()};
const make=(value:number|null=10)=>fact({mint,metric:'price',label:'Price',value,unit:'USD',category:'market'},evidence,at);
afterEach(()=>vi.useRealTimers());

describe('public-data privacy scenarios',()=>{
  it.each([
    'My wallet balance is 9 SOL','Show my portfolio','Analyze my trading history','My phone is 08012345678',
    'I bought five SOL of this','I own this wallet','I have 23 tokens','My name is Jane',
    'Buy 0.5 SOL','Sell two SOL','Swap 100 USDC','Send 1 SOL','0.5 SOL',
    'Here is my private key','seed phrase: alpha beta','API_KEY=secret','Bearer abcdef',
    'Contact me at jane@example.com','https://example.com?token=secret','sk-abcdefghijklmnop',
    'ＡＰＩ ＫＥＹ is secret','api\u200bkey: secret','1'.repeat(90),
  ])('blocks private content: %s',q=>expect(privacyViolation(q)).toBe(true));
  it.each(['Assess the selected token','Analyze this chart','What changed in the last hour?',
    'Explain the discovery columns','Find tokens with top ten concentration below 20%',
    'Compare these exact mints','How do I prepare a trade?','Explain developer holdings',
    'Find tokens with liquidity above 10000 USD','Analyze '+mint,
  ])('allows public research: %s',q=>expect(privacyViolation(q)).toBe(false));
});
describe('evidence and grounded explanations',()=>{
  it.each([undefined,null,'','   ','0xdeadbeef',NaN,Infinity,{},true])('keeps missing numeric values unknown: %s',v=>expect(numeric(v)).toBeNull());
  it('does not accept invalid expiry as fresh',()=>expect(fact({...make(),value:9},{...evidence,expiresAt:'invalid'},at).status).toBe('unavailable'));
  it('rejects observations far in the future',()=>expect(fact({...make(),value:9},{...evidence,observedAt:new Date(at+3600000).toISOString()},at).status).toBe('unavailable'));
  it('preserves measured zero',()=>expect(make(0).value).toBe(0));
  it('does not turn unknown into zero',()=>expect(make(null)).toMatchObject({value:null,status:'unavailable'}));
  it('requires observed evidence',()=>expect(fact({metric:'test',label:'Test',value:0,unit:'%',category:'ownership'}).value).toBeNull());
  it('marks expired observations stale',()=>expect(fact({...make(),value:9},evidence,at+60001).status).toBe('stale'));
  it('keeps tiny values precise',()=>expect(make(0.00000000023).value).toBe(0.00000000023));
  it('rejects unsupported citations',()=>expect(validateAnswer({sections:[{title:'Evidence',text:'Liquidity is measured.',evidenceIds:['invented']}]},[make()])).toBeNull());
  it('rejects numerical claims in prose',()=>expect(validateAnswer({sections:[{title:'Evidence',text:'Price is 99',evidenceIds:[make().id]}]},[make()])).toBeNull());
  it('rejects a real citation with invented financial claim in the runtime protocol',()=>expect(resolveSelection({sections:[{title:'Evidence',text:'This will rise',evidenceIds:[make().id]}]},[make()])).toBeNull());
  it('only accepts supported insight IDs',()=>expect(resolveSelection({insightIds:['i_made_up']},[make()])).toBeNull());
  it('resolves evidence-driven sections without upstream provenance',()=>{
    const facts=[make()]; const insight=buildInsights(facts).find(i=>i.title==='Overview')!;
    const answer=resolveSelection({insightIds:[insight.id]},facts)!;
    expect(answer.validated).toBe(true); expect(answer.sections[0].evidenceIds).toEqual([facts[0].id]);
    expect(JSON.stringify(answer)).not.toMatch(/internal-test|birdeye|helius|gemini/i);
  });
  it('changed evidence invalidates stale insight citations',()=>{
    const old=buildInsights([make()]).find(i=>i.title==='Overview')!;
    expect(resolveSelection({insightIds:[old.id]},[make(20)])).toBeNull();
  });
  it('cannot invent a previous snapshot',()=>expect(changedFacts([make()],[])).toEqual([]));
  it('ignores out-of-order historical observations',()=>expect(changedFacts([make()],[make()])).toEqual([]));
  it('calculates actual deltas only',()=>{
    const next=fact({...make(),value:15},{...evidence,observedAt:new Date(at+1000).toISOString()},at);
    expect(changedFacts([next],[make()],at)[0].value).toBe(5);
  });
  it('does not compare incompatible units',()=>expect(changedFacts([{...make(),unit:'tokens'}],[make()])).toEqual([]));
  it('does not compare stale values',()=>expect(changedFacts([{...make(),status:'stale'}],[make()])).toEqual([]));
});
describe('real candle indicators',()=>{
  function snapshot(n=25):ChartSnapshot {
    return {address:mint,chain:'solana',timeframe:'1m',currency:'usd',market:'token-aggregate',source:'birdeye-ohlcv-v3',status:'measured',observedAt:at,hasMore:false,oldestTime:null,
      candles:Array.from({length:n},(_,i)=>({time:at/1000-(n-1-i)*60,open:10,high:10,low:10,close:10,volume:null,volumeUsd:null}))};
  }
  it('computes flat EMA, Bollinger and RSI from measured bars',()=>{
    vi.useFakeTimers();vi.setSystemTime(at);
    const facts=chartFacts(snapshot());
    expect(facts.find(f=>f.metric==='ema20')?.value).toBeCloseTo(10);
    expect(facts.find(f=>f.metric==='rsi14')?.value).toBe(50);
    expect(facts.find(f=>f.metric==='bollUpper')?.value).toBe(10);
  });
  it.each([0,1,5,14])('does not calculate RSI from %i bars',n=>{
    vi.useFakeTimers();vi.setSystemTime(at);
    expect(chartFacts(snapshot(n)).find(f=>f.metric==='rsi14')?.value).toBeNull();
  });
  it('rejects sparse history rather than padding',()=>{
    vi.useFakeTimers();vi.setSystemTime(at);const data=snapshot();data.candles.splice(5,1);
    expect(chartFacts(data).find(f=>f.metric==='ema20')?.value).toBeNull();
  });
  it('does not use old candles for current indicators',()=>{
    vi.useFakeTimers();vi.setSystemTime(at+10*60000);
    expect(chartFacts(snapshot()).find(f=>f.metric==='ema20')?.value).toBeNull();
  });
  it('labels pool scope explicitly',()=>{
    vi.useFakeTimers();vi.setSystemTime(at);
    expect(chartFacts({...snapshot(),market:'pool'}).find(f=>f.metric==='series')?.value).toBe('Pool-specific USD series');
  });
});
describe('input and tool permissions',()=>{
  it.each([{mint:'SOL'},{chain:'ethereum'},{timeframe:'2m'},{wallet:'secret'},{displayUnit:'wallet'}])('rejects invalid page context %j',context=>expect(contextSchema.safeParse(context).success).toBe(false));
  it('does not accept client-supplied conversation history',()=>expect(requestSchema.safeParse({requestId:crypto.randomUUID(),question:'Hi',context:{},privacyAccepted:true,messages:[]}).success).toBe(false));
  it('requires explicit privacy consent',()=>expect(requestSchema.safeParse({requestId:crypto.randomUUID(),question:'Hi',context:{},privacyAccepted:false}).success).toBe(false));
  it('cannot compare more than three mints',()=>expect(skills.compare_tokens.schema.safeParse({mints:Array(4).fill(mint)}).success).toBe(false));
  it('rejects arbitrary SQL and URLs in tool arguments',()=>expect(skills.discovery_search.schema.safeParse({sql:'SELECT *',url:'https://evil.example'}).success).toBe(false));
  it('contains no signing or wallet tools',()=>expect(Object.keys(skills).join(' ')).not.toMatch(/sign|broadcast|transfer|wallet|portfolio|sql|fetch/));
  it('rejects wrong historical window',()=>expect(skills.what_changed.schema.safeParse({mint,minutes:1}).success).toBe(false));
});
