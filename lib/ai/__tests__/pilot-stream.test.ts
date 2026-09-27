import { expect, it } from 'vitest';
import { readPilotStream } from '../pilot/stream';
import type { PilotEvent } from '../pilot/contracts';

it('decodes fragmented UTF-8 and SSE frames without dropping evidence',async()=>{
  const text='data: '+JSON.stringify({type:'progress',message:'Reviewing…'})+'\r\n\r\ndata: '+JSON.stringify({type:'done',requestId:'done'})+'\n\n';
  const bytes=new TextEncoder().encode(text);
  const stream=new ReadableStream<Uint8Array>({start(c){for(const byte of bytes)c.enqueue(new Uint8Array([byte]));c.close();}});
  const events:PilotEvent[]=[];
  await readPilotStream(stream,e=>events.push(e));
  expect(events).toEqual([{type:'progress',message:'Reviewing…'},{type:'done',requestId:'done'}]);
});
it('reports truncated frames instead of completing silently',async()=>{
  const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode('data: {'));c.close();}});
  await expect(readPilotStream(stream,()=>undefined)).rejects.toThrow('Interrupted response');
});
