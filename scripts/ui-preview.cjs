// Isolated UI preview: separate compiler output from an existing dev server.
const { createServer } = require('node:http');
const next = require('next');

async function main() {
  process.env.MARKET_STREAM_ENABLED = 'false';
  process.env.SENTINEL_UI_PREVIEW = 'true';
  const app = next({ dev: true, hostname: '127.0.0.1', port: 3002 });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  server.listen(3002, '127.0.0.1', () => console.log('UI preview: http://127.0.0.1:3002'));
  server.on('error', error => { console.error(error); process.exit(1); });
}
main().catch(error => { console.error(error); process.exit(1); });
