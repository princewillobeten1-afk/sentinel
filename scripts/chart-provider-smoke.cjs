// Read-only candle capability check. Never prints credentials or submits transactions.
require('@next/env').loadEnvConfig(process.cwd());
const WS = require('ws');
const fs = require('node:fs/promises');
const path = require('node:path');
const mint = process.env.CHART_SMOKE_MINT || 'So11111111111111111111111111111111111111112';
async function main() {
  const key = process.env.BIRDEYE_API_KEY?.trim();
  if (!key) throw new Error('Birdeye credential not configured');
  const results = { checkedAt: new Date().toISOString(), mint, rest: [], websocket: { connected: false, frames: [], rejection: null } };
  for (const type of ['1m', '15m']) {
    const params = new URLSearchParams({ address: mint, type, currency: 'usd', mode: 'count', count_limit: '5', time_to: String(Math.floor(Date.now() / 1000)), padding: 'false' });
    const response = await fetch(`https://public-api.birdeye.so/defi/v3/ohlcv?${params}`, {
      headers: { 'X-API-KEY': key, 'x-chain': 'solana' }, signal: AbortSignal.timeout(12000),
    });
    const body = await response.json();
    results.rest.push({ type, status: response.status, success: body.success, dataKeys: Object.keys(body.data || {}),
      items: body.data?.items?.slice(-3), error: !body.success ? String(body.message || '').split(key).join('[redacted]').slice(0, 250) : undefined });
    if (type === '1m') await new Promise(resolve => setTimeout(resolve, 2500));
  }
  await new Promise(resolve => {
    const socket = new WS(`wss://public-api.birdeye.so/socket/solana?x-api-key=${key}`, 'echo-protocol', {
      headers: { Origin: 'ws://public-api.birdeye.so', 'Sec-WebSocket-Origin': 'ws://public-api.birdeye.so' }, handshakeTimeout: 8000,
    });
    const finish = () => { clearTimeout(timer); socket.terminate(); resolve(); };
    const timer = setTimeout(finish, 18000);
    socket.on('open', () => {
      results.websocket.connected = true;
      socket.send(JSON.stringify({ type: 'SUBSCRIBE_PRICE', data: { queryType: 'complex',
        query: `(address = ${mint} AND chartType = 1m AND currency = usd) OR (address = ${mint} AND chartType = 15m AND currency = usd)` } }));
    });
    socket.on('message', raw => {
      try {
        const message = JSON.parse(String(raw));
        if (message.type === 'ERROR') {
          results.websocket.rejection = /api.?key|origin/i.test(JSON.stringify(message.data)) ? 'origin-or-key' : 'subscription-rejected';
          finish();
        } else if (message.type === 'PRICE_DATA' || message.type === 'DATA_PRICE') {
          const d = message.data || {};
          results.websocket.frames.push({ type: message.type, data: Object.fromEntries(['address','type','eventType','unixTime','o','h','l','c','v','vUsd','currency'].filter(key => key in d).map(key => [key,d[key]])) });
          if (results.websocket.frames.length >= 4) finish();
        }
      } catch {}
    });
    socket.on('error', () => { results.websocket.rejection = 'connection-failed'; finish(); });
    socket.on('close', () => { clearTimeout(timer); resolve(); });
  });
  const output = path.join(process.cwd(), 'artifacts', 'real-chart');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'provider-smoke.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ failed: true, error: error.name })); process.exitCode = 1; });
