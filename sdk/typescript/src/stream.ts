/**
 * Real-time streaming client for the WebSocket API (`lib/ws/**`, Sprint 28
 * §12-14). Topics are `namespace.event:target`, e.g. `token.price:So111...`
 * — see `lib/ws/topics.ts` for the registry (`token.price`, `token.trade`,
 * `token.risk`).
 *
 * Works in both the browser (native `WebSocket`) and Node (via the optional
 * `ws` peer dependency, loaded lazily so this file has no hard dependency on
 * it).
 */

export interface StreamEvent {
  topic: string;
  sequence: number;
  data: unknown;
  ts: string;
}

export type StreamEventHandler = (event: StreamEvent) => void;
export type StreamErrorHandler = (error: { code: string; message: string }) => void;

interface WebSocketLike {
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  readyState: number;
  send(data: string): void;
  close(): void;
}

type WebSocketCtor = new (url: string) => WebSocketLike;

export interface SentinelStreamOptions {
  apiKey: string;
  /** Same base URL as `SentinelClient` — converted to `ws(s)://.../ws` automatically. */
  baseUrl: string;
  /** Injectable for non-browser/non-Node runtimes. Defaults to `globalThis.WebSocket`, falling back to `require('ws')`. */
  WebSocketImpl?: WebSocketCtor;
}

const OPEN = 1;

export class SentinelStream {
  private readonly url: string;
  private readonly WebSocketImpl: WebSocketCtor;
  private ws: WebSocketLike | null = null;
  private readonly topicHandlers = new Map<string, Set<StreamEventHandler>>();
  private readonly wildcardHandlers = new Set<StreamEventHandler>();
  private errorHandler: StreamErrorHandler | null = null;
  private readonly subscribedTopics = new Set<string>();

  constructor(options: SentinelStreamOptions) {
    const wsBaseUrl = options.baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '');
    this.url = `${wsBaseUrl}/ws?apiKey=${encodeURIComponent(options.apiKey)}`;
    this.WebSocketImpl = options.WebSocketImpl ?? resolveWebSocketImpl();
  }

  /** Opens the connection. Resolves once the server sends `welcome`. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new this.WebSocketImpl(this.url);
      this.ws = ws;

      ws.onopen = () => {
        // Resolution happens on 'welcome' below, once the server confirms auth.
      };
      ws.onerror = () => {
        reject(new Error('WebSocket connection failed.'));
      };
      ws.onclose = () => {
        this.ws = null;
      };
      ws.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : String(event.data);
        let parsed: { type: string; [key: string]: unknown };
        try {
          parsed = JSON.parse(raw);
        } catch {
          return;
        }

        if (parsed.type === 'welcome') {
          // Re-subscribe on reconnect so callers don't have to track topic state themselves.
          if (this.subscribedTopics.size > 0) this.sendSubscribe([...this.subscribedTopics]);
          resolve();
          return;
        }

        if (parsed.type === 'event') {
          const streamEvent = parsed as unknown as StreamEvent;
          for (const handler of this.topicHandlers.get(streamEvent.topic) ?? []) handler(streamEvent);
          for (const handler of this.wildcardHandlers) handler(streamEvent);
          return;
        }

        if (parsed.type === 'error') {
          this.errorHandler?.({ code: parsed.code as string, message: parsed.message as string });
        }
      };
    });
  }

  /** Subscribes to one or more topics. Requires the topic's mapped scope on the API key (see `lib/ws/topics.ts`). */
  subscribe(topics: string[]): void {
    for (const topic of topics) this.subscribedTopics.add(topic);
    this.sendSubscribe(topics);
  }

  unsubscribe(topics: string[]): void {
    for (const topic of topics) this.subscribedTopics.delete(topic);
    this.send({ type: 'unsubscribe', topics });
  }

  /** Registers a handler for one topic, or every event when `topic` is `'*'`. Returns an unsubscribe function. */
  on(topic: string | '*', handler: StreamEventHandler): () => void {
    if (topic === '*') {
      this.wildcardHandlers.add(handler);
      return () => this.wildcardHandlers.delete(handler);
    }
    const set = this.topicHandlers.get(topic) ?? new Set();
    set.add(handler);
    this.topicHandlers.set(topic, set);
    return () => set.delete(handler);
  }

  onError(handler: StreamErrorHandler): void {
    this.errorHandler = handler;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  private sendSubscribe(topics: string[]): void {
    this.send({ type: 'subscribe', topics });
  }

  private send(message: { type: string; topics?: string[] }): void {
    if (!this.ws || this.ws.readyState !== OPEN) {
      throw new Error('SentinelStream is not connected — call connect() first and await it.');
    }
    this.ws.send(JSON.stringify(message));
  }
}

function resolveWebSocketImpl(): WebSocketCtor {
  const globalWs = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  if (globalWs) return globalWs;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('ws');
    return (mod.WebSocket ?? mod) as WebSocketCtor;
  } catch {
    throw new Error(
      "No WebSocket implementation found. In Node, install the 'ws' package, or pass { WebSocketImpl } explicitly.",
    );
  }
}
