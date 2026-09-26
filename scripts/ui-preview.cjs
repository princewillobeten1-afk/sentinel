// Isolated UI preview: separate compiler output from an existing dev server.
const { createServer, request } = require('node:http');
const { connect } = require('node:net');
const next = require('next');

async function main() {
  process.env.MARKET_STREAM_ENABLED = 'false';
  process.env.SENTINEL_UI_PREVIEW = 'true';
  const app = next({ dev: true, hostname: '127.0.0.1', port: 3002 });
  await app.prepare();
  // Optional local backend reuse: one live-data worker, not two competing
  // provider stacks. Keep credentials server-side and reject external targets.
  const backend = process.env.UI_PREVIEW_BACKEND ? new URL(process.env.UI_PREVIEW_BACKEND) : null;
  if (backend && (backend.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(backend.hostname)
    || backend.username || backend.password || backend.port === '3002')) {
    throw new Error('UI_PREVIEW_BACKEND must be a different, local HTTP backend');
  }
  const handle = app.getRequestHandler();
  const server = createServer((req, res) => {
    if (!backend || !req.url?.startsWith('/api/')) return handle(req, res);
    const upstream = request(new URL(req.url, backend), {
      // Preserve Host and Origin together: backend same-origin/CSRF checks
      // still validate the browser's real local preview origin.
      method: req.method, headers: req.headers,
    }, response => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Local preview backend unavailable' }));
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  });
  const handleUpgrade = app.getUpgradeHandler();
  server.on('upgrade', (req, socket, head) => {
    if (!backend || new URL(req.url, 'http://localhost').pathname !== '/ws') {
      return handleUpgrade(req, socket, head);
    }
    const upstream = connect(Number(backend.port || 80), backend.hostname.replace(/^\[|\]$/g, ''), () => {
      const headers = Object.entries(req.headers)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\r\n');
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
  });
  server.listen(3002, '127.0.0.1', () => console.log('UI preview: http://127.0.0.1:3002'));
  server.on('error', error => { console.error(error); process.exit(1); });
}
main().catch(error => { console.error(error); process.exit(1); });
