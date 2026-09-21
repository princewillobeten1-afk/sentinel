'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { subscribeMessage, unsubscribeMessage } from '@/lib/ws/client-messages';

export interface SentinelWSMessage {
  type: 'welcome' | 'subscribed' | 'unsubscribed' | 'event' | 'error' | 'ping' | 'pong';
  topic?: string;
  sequence?: number;
  data?: any;
  ts?: string;
  code?: string;
  message?: string;
  connectionId?: string;
  maxSubscriptions?: number;
  topics?: string[];
}

export type SentinelWSEventHandler = (data: any, fullMessage: SentinelWSMessage) => void;

class SentinelWSClient {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscribedTopics = new Set<string>();
  private handlers = new Map<string, Set<SentinelWSEventHandler>>();
  private allHandlers = new Set<(msg: SentinelWSMessage) => void>();
  private stateChangeListeners = new Set<(connected: boolean) => void>();
  private isExplicitlyClosed = false;
  /**
   * Set once the server's `welcome` arrives.
   *
   * Subscriptions are held back until then. A subscribe sent on `open` lands
   * before the server has attached its message listener and is silently
   * dropped — measured at 0 events delivered versus 32 when the same
   * subscribe waits for `welcome`.
   */
  private welcomed = false;

  constructor() {
    this.url = this.getWsUrl();
  }

  private getWsUrl(): string {
    if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  public get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.url = this.getWsUrl();

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.welcomed = false;
        this.notifyStateChange(true);
        // Deliberately no subscribe here — see `welcomed`. The server attaches
        // its message listener as it sends `welcome`, so anything written
        // before that is discarded without an error.
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: SentinelWSMessage = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch {
          // Ignore non-JSON frames
        }
      };

      this.socket.onerror = () => {
        // Handled in onclose
      };

      this.socket.onclose = () => {
        this.notifyStateChange(false);
        this.socket = null;
        // The next connection has its own handshake; leaving this true would
        // let a subscribe race ahead of the new socket's `welcome`.
        this.welcomed = false;

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Backoff cap at 10s
      this.reconnectTimer = setTimeout(() => this.connect(), 10000);
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 500, 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private handleIncomingMessage(msg: SentinelWSMessage): void {
    // 1. The server is ready for subscriptions.
    //
    // Liveness is handled below the application protocol: the server sends
    // real WebSocket pings and terminates on a missed pong, which the browser
    // answers automatically. There is no client-bound `{type:'ping'}` in
    // ServerMessage, so nothing here needs to reply to one.
    if (msg.type === 'welcome') {
      this.welcomed = true;
      if (this.subscribedTopics.size > 0) {
        this.send(subscribeMessage(Array.from(this.subscribedTopics)));
      }
      return;
    }

    // 2. Dispatch to topic handlers
    if (msg.type === 'event' && msg.topic) {
      const topicHandlers = this.handlers.get(msg.topic);
      if (topicHandlers) {
        for (const handler of topicHandlers) {
          try {
            handler(msg.data, msg);
          } catch (e) {
            console.error('[SentinelWS] Error in topic handler:', e);
          }
        }
      }
    }

    // 3. Dispatch to global handlers
    for (const handler of this.allHandlers) {
      try {
        handler(msg);
      } catch (e) {
        console.error('[SentinelWS] Error in global message handler:', e);
      }
    }
  }

  public subscribe(topics: string | string[]): void {
    const list = Array.isArray(topics) ? topics : [topics];
    const newTopics: string[] = [];

    for (const t of list) {
      if (!this.subscribedTopics.has(t)) {
        this.subscribedTopics.add(t);
        newTopics.push(t);
      }
    }

    // Held until `welcome`; the handler flushes everything in
    // `subscribedTopics`, so a topic added before then is not lost.
    if (newTopics.length > 0 && this.isConnected && this.welcomed) {
      this.send(subscribeMessage(newTopics));
    }
  }

  public unsubscribe(topics: string | string[]): void {
    const list = Array.isArray(topics) ? topics : [topics];
    const removedTopics: string[] = [];

    for (const t of list) {
      if (this.subscribedTopics.has(t)) {
        this.subscribedTopics.delete(t);
        removedTopics.push(t);
      }
    }

    if (removedTopics.length > 0 && this.isConnected && this.welcomed) {
      this.send(unsubscribeMessage(removedTopics));
    }
  }

  public on(topic: string, handler: SentinelWSEventHandler): () => void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler);

    return () => {
      set?.delete(handler);
      if (set && set.size === 0) {
        this.handlers.delete(topic);
      }
    };
  }

  public onAll(handler: (msg: SentinelWSMessage) => void): () => void {
    this.allHandlers.add(handler);
    return () => {
      this.allHandlers.delete(handler);
    };
  }

  public onStateChange(listener: (connected: boolean) => void): () => void {
    this.stateChangeListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  private notifyStateChange(connected: boolean): void {
    for (const listener of this.stateChangeListeners) {
      listener(connected);
    }
  }

  public send(payload: any): void {
    if (this.isConnected) {
      this.socket?.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// Global Singleton for the browser session
let globalClient: SentinelWSClient | null = null;

export function getSentinelWSClient(): SentinelWSClient {
  if (!globalClient) {
    globalClient = new SentinelWSClient();
  }
  return globalClient;
}

/**
 * React hook to connect to the internal Sentinel WebSocket gateway and listen to topics.
 *
 * @param topics Optional topic or list of topics to automatically subscribe to (e.g. `token.price:DezX...`, `token.trade:DezX...`)
 * @param onEvent Callback triggered on incoming topic events
 */
export function useSentinelWS(topics?: string | string[], onEvent?: SentinelWSEventHandler) {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<SentinelWSClient | null>(null);
  const onEventRef = useRef<SentinelWSEventHandler | undefined>(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const client = getSentinelWSClient();
    clientRef.current = client;
    client.connect();

    const unsubState = client.onStateChange((connected) => {
      setIsConnected(connected);
    });

    return () => {
      unsubState();
    };
  }, []);

  const topicsKey = topics ? (Array.isArray(topics) ? topics.join(',') : topics) : '';

  useEffect(() => {
    if (!topicsKey) return;
    const client = getSentinelWSClient();
    const topicList = topicsKey.split(',').filter(Boolean);

    client.subscribe(topicList);

    const unsubs: (() => void)[] = [];
    for (const t of topicList) {
      unsubs.push(
        client.on(t, (data, fullMessage) => {
          onEventRef.current?.(data, fullMessage);
        })
      );
    }

    return () => {
      for (const unsub of unsubs) unsub();
      client.unsubscribe(topicList);
    };
  }, [topicsKey]);

  const subscribe = useCallback((t: string | string[]) => {
    clientRef.current?.subscribe(t);
  }, []);

  const unsubscribe = useCallback((t: string | string[]) => {
    clientRef.current?.unsubscribe(t);
  }, []);

  return {
    client: clientRef.current,
    isConnected,
    subscribe,
    unsubscribe,
  };
}
