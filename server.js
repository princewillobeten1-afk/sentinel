/**
 * Custom Next.js server entrypoint (Sprint 28 §12-13).
 *
 * Exists solely so Sentinel can run a real WebSocket server for the
 * developer streaming API alongside Next.js on a single port. Next's own
 * `next dev` / `next start` can't host a WS server, so this replaces them
 * (see package.json scripts).
 *
 * Three things here are load-bearing and easy to get wrong:
 *
 * 1. The `upgrade` handler MUST delegate `/_next/*` back to Next via
 *    `app.getUpgradeHandler()`. Next uses its own WebSocket for dev-mode
 *    Fast Refresh; swallowing that upgrade silently breaks hot reload while
 *    leaving everything else apparently working.
 *
 * 2. This file is plain CommonJS and therefore CANNOT `require()` the
 *    TypeScript in `lib/ws/*`. Instead it publishes the raw
 *    `WebSocketServer` on `globalThis.__sentinelWss` BEFORE calling
 *    `app.prepare()`, and `instrumentation.ts` — which runs inside Next's
 *    TS-capable runtime — picks it up and attaches the real auth/topic/
 *    broadcast handlers. That ordering is required: `app.prepare()` is what
 *    triggers the instrumentation hook.
 *
 * 3. `instrumentation.ts`'s existing Birdeye/Helius stream bootstrap is
 *    unaffected — it's triggered by `app.prepare()` regardless of which
 *    server wraps Next.
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || 'localhost';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Created and published BEFORE app.prepare() so instrumentation.ts can find it.
const wss = new WebSocketServer({ noServer: true });
globalThis.__sentinelWss = wss;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const nextUpgradeHandler = app.getUpgradeHandler();

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/', true);

    // Next's dev-mode Fast Refresh socket — must pass through untouched.
    if (pathname && pathname.startsWith('/_next')) {
      nextUpgradeHandler(req, socket, head);
      return;
    }

    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
      return;
    }

    socket.destroy();
  });

  server.on('error', (err) => {
    console.error('> Server error:', err);
  });

  server.listen(port, () => {
    console.log(`> Sentinel ready on http://${hostname}:${port}`);
    console.log(`> WebSocket streaming on ws://${hostname}:${port}/ws`);

    // Attaches the WS server's real handlers + starts the webhook dispatcher.
    // Done via an internal HTTP call rather than a direct require() here
    // because this file is plain CommonJS and can't import the TypeScript
    // in lib/ws/* — see app/api/internal/ws-bootstrap/route.ts for why that
    // logic lives in an ordinary API route instead of instrumentation.ts.
    fetch(`http://${hostname}:${port}/api/internal/ws-bootstrap`, { method: 'POST' })
      .then((res) => res.json())
      .then((body) => console.log('> WS bootstrap:', JSON.stringify(body)))
      .catch((err) => console.error('> WS bootstrap failed:', err.message));
  });
}).catch((err) => {
  console.error('> app.prepare() error:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('> Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('> Unhandled Rejection at:', promise, 'reason:', reason);
});

