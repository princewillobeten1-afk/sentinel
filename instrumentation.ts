/**
 * Next.js instrumentation hook — runs once per server process on boot.
 * Starts the Birdeye/Helius market data streams without needing an inbound
 * HTTP request (`lib/market/live/stream-manager.ts`). `start()` is
 * idempotent, so this is safe alongside the defensive import in the debug
 * status route.
 *
 * Deliberately minimal: this file's import graph gets bundled by Next for
 * an edge-compatible target in addition to nodejs (confirmed via a build
 * error — "UnhandledSchemeError: Reading from node:crypto is not handled"
 * — even with `export const runtime = 'nodejs'` set and even using the
 * `node:` protocol prefix). `lib/market/live/stream-manager.ts`'s graph
 * happens not to touch Node's `crypto`, so it's safe here; the WebSocket
 * server and webhook dispatcher DO (via `lib/server/api-keys.ts`), so their
 * startup is triggered from `app/api/internal/ws-bootstrap/route.ts`
 * instead — an ordinary API route, which compiles through Next's normal
 * (non-edge) server target and has no such restriction. `server.js` calls
 * that route once, right after it starts listening.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { marketStreamManager } = await import('@/lib/market/live/stream-manager');
    marketStreamManager.start();
  }
}
