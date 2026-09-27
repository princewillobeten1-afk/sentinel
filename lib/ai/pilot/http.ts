import { randomUUID } from 'node:crypto';
import { errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requirePilotUser } from './config';
import { requestSchema, type PilotEvent } from './contracts';
import { privacyViolation } from './privacy';
import { openSession } from './repository';
import { reserveAnswer } from './quota';
import { runPilot } from './runtime';

async function readBoundedBody(req: Request) {
  if (!req.body) return '';
  const reader = req.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      bytes += value?.byteLength ?? 0;
      if (bytes > 8000) { await reader.cancel(); throw new ApiError('Question is too large.',413,'AI_INPUT_LIMIT'); }
      text += decoder.decode(value, { stream: !done });
      if (done) return text;
    }
  } finally { reader.releaseLock(); }
}

export async function copilotPost(req: Request) {
  try {
    const user=await requirePilotUser(req,true);
    const raw=await readBoundedBody(req);
    let body:unknown; try {body=JSON.parse(raw);} catch {throw new ApiError('Invalid request.',400,'AI_INVALID_REQUEST');}
    const parsed=requestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('A public question, valid context and privacy consent are required.',400,'AI_INVALID_REQUEST');
    const request=parsed.data;
    if (privacyViolation(request.question)) throw new ApiError('Public market questions only. Keep personal details and trade amounts outside chat.',400,'AI_PUBLIC_DATA_ONLY');
    const sessionId=await openSession(user.userId,request.sessionId);
    const release=await reserveAnswer(user.userId,request.requestId);
    const controller=new AbortController(), abort=()=>controller.abort();
    req.signal.addEventListener('abort',abort,{once:true}); if(req.signal.aborted) abort();
    const encoder=new TextEncoder(); let closed=false;
    const stream=new ReadableStream({
      start(streamController) {
        const emit=(event:PilotEvent)=>{if(!closed) streamController.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'));};
        const timer=setTimeout(()=>{emit({type:'error',code:'AI_DEADLINE',message:'Analysis timed out. Available evidence is retained.',reference:randomUUID()});controller.abort();},45000);
        const task=runPilot(user.userId,sessionId,request,controller.signal,emit);
        const interrupted=new Promise<void>(resolve=>{if(controller.signal.aborted) resolve(); else controller.signal.addEventListener('abort',()=>resolve(),{once:true});});
        void Promise.race([task,interrupted]).catch(()=>{
          if(!closed && !controller.signal.aborted) emit({type:'error',code:'AI_UNAVAILABLE',message:'Copilot could not complete this request.',reference:randomUUID()});
        }).finally(()=>{
          clearTimeout(timer);req.signal.removeEventListener('abort',abort);
          if(!closed){closed=true;streamController.close();}
          void task.catch(()=>undefined).finally(()=>release().catch(()=>undefined));
        });
      },
      cancel(){closed=true;controller.abort();},
    });
    return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store, private','X-Accel-Buffering':'no'}});
  }catch(error){return errorResponse(error instanceof ApiError ? error : new ApiError('Copilot storage or coordination is unavailable.',503,'AI_UNAVAILABLE'));}
}
