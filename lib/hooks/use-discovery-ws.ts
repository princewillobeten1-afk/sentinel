'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeReconnectDelayMs,
  initialReconnectState,
  reconnectReducer,
  type ReconnectState,
} from './discovery-ws-reconnect';

/**
 * Real-time discovery feed trigger over WebSocket (Sprint 31 — Item 7).
 *
 * Connects to `/ws` with no `apiKey` — relies entirely on the
 * `sentinel_session` cookie (`lib/ws/server.ts`'s session-auth path). WS is
 * used purely as a "something changed, go refetch" signal: any `event`
 * message received for a subscribed topic calls `onSignal()`, which the
 * caller wires to its existing REST refetch. This is deliberately an
 * enhancement, never a hard dependency — if the socket never connects, or
 * gives up after repeated failures, the caller's normal polling keeps the
 * feed working with no user-visible error.
 */
export function useDiscoveryWs(topics: string[], onSignal: () => void) {
  const [state, setState] = useState<ReconnectState>(initialReconnectState());
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const topicsRef = useRef<string[]>(topics);
  const onSignalRef = useRef(onSignal);
  const unmountedRef = useRef(false);

  topicsRef.current = topics;
  onSignalRef.current = onSignal;

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || unmountedRef.current) return;

    setState((s) => reconnectReducer(s, { type: 'CONNECT_REQUESTED' }));

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      subscribedRef.current = new Set();
      setState((s) => reconnectReducer(s, { type: 'OPENED' }));
      if (topicsRef.current.length > 0) {
        socket.send(JSON.stringify({ type: 'subscribe', topics: topicsRef.current }));
        subscribedRef.current = new Set(topicsRef.current);
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'event') onSignalRef.current();
      } catch {
        // Malformed frame — WS is a best-effort signal, never load-bearing.
      }
    };

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
      if (unmountedRef.current) return;

      setState((s) => {
        const next = reconnectReducer(s, { type: 'CLOSED' });
        if (next.status === 'reconnecting') {
          const delay = computeReconnectDelayMs(next.attempt);
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        }
        return next;
      });
    };

    socket.onerror = () => {
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-diff subscriptions against the currently-visible token set whenever
  // it changes, so the connection never accumulates stale subscriptions for
  // tokens that scrolled out of view.
  useEffect(() => {
    const socket = socketRef.current;
    if (state.status !== 'open' || !socket || socket.readyState !== WebSocket.OPEN) return;

    const nextSet = new Set(topics);
    const toSubscribe = topics.filter((topic) => !subscribedRef.current.has(topic));
    const toUnsubscribe = [...subscribedRef.current].filter((topic) => !nextSet.has(topic));

    if (toSubscribe.length > 0) socket.send(JSON.stringify({ type: 'subscribe', topics: toSubscribe }));
    if (toUnsubscribe.length > 0) socket.send(JSON.stringify({ type: 'unsubscribe', topics: toUnsubscribe }));

    subscribedRef.current = nextSet;
  }, [topics, state.status]);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    socketRef.current?.close();
    setState((s) => reconnectReducer(s, { type: 'MANUAL_RECONNECT' }));
    connect();
  }, [connect]);

  return { status: state.status, reconnect };
}
