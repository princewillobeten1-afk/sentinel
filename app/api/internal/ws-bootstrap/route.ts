import { jsonResponse } from '@/lib/server/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/ws-bootstrap
 *
 * Not a developer-facing endpoint — `server.js` calls this exactly once,
 * right after it starts listening, to attach the WebSocket server's
 * handlers and start the webhook dispatcher. See instrumentation.ts for why
 * this can't live there: an ordinary API route compiles through Next's
 * normal server target, which (unlike instrumentation.ts's target in this
 * Next version) has no trouble with `lib/server/api-keys.ts`'s use of
 * Node's `crypto`.
 *
 * Idempotent — `attachWebSocketServer`/`start()` are safe to call more than
 * once, so a stray extra call (e.g. a dev-mode double-invocation) is harmless.
 */
export async function POST() {
  const wss = (globalThis as unknown as { __sentinelWss?: import('ws').WebSocketServer }).__sentinelWss;

  const { webhookDispatcher } = await import('@/lib/webhooks/dispatcher');
  webhookDispatcher.start();

  // Keeps token prices current. Same reasoning as the dispatcher for living
  // here rather than in instrumentation.ts: it spawns the `db/*.js` jobs and
  // so needs the Node target. Idempotent, and a no-op unless
  // TOKEN_REFRESH_ENABLED=true.
  const { tokenRefreshWorker } = await import('@/lib/market-data/refresh/token-refresh-worker');
  tokenRefreshWorker.start();

  if (!wss) {
    return jsonResponse({ webSocketAttached: false, reason: 'No WebSocketServer published on globalThis (not running under server.js).' });
  }

  const [{ attachWebSocketServer }, { wsBroadcaster }, { eventBus }] = await Promise.all([
    import('@/lib/ws/server'),
    import('@/lib/ws/broadcaster'),
    import('@/lib/server/events/event-bus'),
  ]);

  attachWebSocketServer(wss);
  wsBroadcaster.start();

  // Subscribe to events ingested by *other* server instances. Without this a
  // client connected to instance B never sees a token detected by instance A.
  // Awaited but non-fatal: with no Redis configured this resolves immediately
  // and the bus stays local-only, which is correct for a single instance.
  let redisFanout = false;
  try {
    redisFanout = await eventBus.subscribeToRemote();
  } catch {
    // Degraded to local-only delivery; ingestion and local WS are unaffected.
  }

  return jsonResponse({ webSocketAttached: true, redisFanout });
}
