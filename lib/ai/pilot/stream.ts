import type { PilotEvent } from './contracts';

/** Frame buffering is separate from UI state; fetch chunks need not align with SSE events. */
export async function readPilotStream(body: ReadableStream<Uint8Array>, onEvent: (event: PilotEvent) => void) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r/g, '');
      if (buffer.length > 1_000_000) throw new Error('Invalid response frame');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data) {
          const event = JSON.parse(data) as PilotEvent;
          if (['session', 'progress', 'evidence', 'answer', 'error', 'done'].includes(event.type)) onEvent(event);
        }
      }
      if (done) { if (buffer.trim()) throw new Error('Interrupted response'); break; }
    }
  } finally { reader.releaseLock(); }
}
