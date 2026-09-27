// Opt-in live evaluation through the ordinary authenticated endpoint. Quotas are NOT bypassed.
const { loadEnvConfig } = require('@next/env');
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const cases = require('../lib/ai/pilot/evaluation-cases.json');
async function main() {
  loadEnvConfig(process.cwd());
  const base = new URL(process.env.AI_EVAL_BASE_URL || 'http://localhost:3000');
  if (!['localhost','127.0.0.1'].includes(base.hostname) || base.username || base.password || base.search || base.protocol !== 'http:') throw new Error('Use a loopback development server.');
  if (!process.argv.includes('--run') || !process.env.AI_EVAL_SESSION_TOKEN) throw new Error('Opt in with --run and a server-local AI_EVAL_SESSION_TOKEN. Never paste the token in chat.');
  const ids=process.argv.filter(arg=>arg.startsWith('pilot-'));
  if(!ids.length) throw new Error('Choose explicit case IDs, for example pilot-01. No unbounded batch runs.');
  const selected=cases.filter(c=>ids.includes(c.id));
  if(selected.length!==ids.length) throw new Error('Unknown or duplicate case ID.');
  const url=process.env.DATABASE_URL;
  const cloud=/supabase\.co|pooler\.supabase\.com|sslmode=require|neon\.tech|amazonaws\.com/.test(url||'');
  const db=new Client({connectionString:url,ssl:cloud?{rejectUnauthorized:false}:undefined,connectionTimeoutMillis:10000});
  const output=path.join(process.cwd(),'artifacts','copilot','live-evaluation.json');
  let results={};try{results=JSON.parse(await fs.readFile(output,'utf8'));}catch{}
  try {
    await db.connect();
    for(const scenario of selected) {
      const requestId=randomUUID();
      const response=await fetch(new URL('/api/v1/ai/copilot',base),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.AI_EVAL_SESSION_TOKEN},
        body:JSON.stringify({requestId,question:scenario.question,context:scenario.context,privacyAccepted:true}),signal:AbortSignal.timeout(65000)});
      const text=await response.text();
      let errorCode;try{errorCode=JSON.parse(text).error?.code;}catch{}
      if(response.status===429 || response.status===401 || response.status===403 || response.status===503) {console.log(JSON.stringify({case:scenario.id,status:response.status,code:errorCode||'unavailable',stopped:true}));break;}
      const {rows}=await db.query('SELECT tool_outcomes,request_status,model_id,prompt_version FROM ai_usage_metrics WHERE id=$1',[requestId]);
      const calls=rows[0]?.tool_outcomes||[];
      const passed=scenario.expectBlocked ? errorCode==='AI_PUBLIC_DATA_ONLY' && !rows.length
        : calls.some(c=>c.tool===scenario.expectedTool && c.status==='ok') && rows[0]?.request_status==='complete';
      results[scenario.id]={passed,expectedTool:scenario.expectedTool,tools:calls,model:rows[0]?.model_id,promptVersion:rows[0]?.prompt_version,observedAt:new Date().toISOString()};
      console.log(JSON.stringify({case:scenario.id,passed}));
      await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(results,null,2));
      if(text.includes('AI_QUOTA_EXHAUSTED')) break;
    }
    const complete=cases.every(c=>results[c.id]);
    const research=cases.filter(c=>!c.expectBlocked),privacy=cases.filter(c=>c.expectBlocked);
    const accuracy=research.filter(c=>results[c.id]?.passed).length/research.length;
    const privacyPassed=privacy.every(c=>results[c.id]?.passed);
    console.log(JSON.stringify({complete,accuracy,privacyPassed,activationGate:complete&&privacyPassed&&accuracy>=0.9}));
  } finally {await db.end();}
}
main().catch(()=>{console.error('Evaluation could not complete. Check local setup and server diagnostics; credentials were not logged.');process.exitCode=1;});
