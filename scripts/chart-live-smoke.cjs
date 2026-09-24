// Read-only Birdeye OHLCV WebSocket probe. Never logs the API key or raw payloads.
require('@next/env').loadEnvConfig(process.cwd());
const WebSocket = require('ws');

const mint = process.env.CHART_SMOKE_MINT || 'So11111111111111111111111111111111111111112';
const key = process.env.BIRDEYE_API_KEY?.trim();
if (!key) {
  console.error('Birdeye API key is not configured.');
  process.exit(2);
}

const origin = process.env.CHART_SMOKE_ORIGIN || 'ws://public-api.birdeye.so';
const socket = new WebSocket(`${process.env.BIRDEYE_WS_URL || 'wss://public-api.birdeye.so/socket/solana'}?x-api-key=${encodeURIComponent(key)}`,
  'echo-protocol', { headers: { Origin: origin, 'Sec-WebSocket-Origin': origin },
    handshakeTimeout: 8_000 });
let connected = false;
let frames = 0;
let rejected = false;
let providerError = null;
let providerDetail = null;
let finished = false;
const finish = (reason) => {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  socket.terminate();
  console.log(JSON.stringify({ connected, frames, rejected, providerError, providerDetail, reason }));
  if (frames === 0) process.exitCode = 1;
};
const timeout = setTimeout(() => finish('no-OHLCV-frame-before-timeout'), 45_000);
socket.on('open', () => {
  connected = true;
  const data = process.env.CHART_SMOKE_SIMPLE === '1'
    ? { queryType: 'simple', address: mint, chartType: '1m', currency: 'usd', mode: 'raw' }
    : { queryType: 'complex', query: `(address = ${mint} AND chartType = 1m AND currency = usd)` };
  socket.send(JSON.stringify({ type: 'SUBSCRIBE_PRICE', data }));
});
socket.on('message', raw => {
  try {
    const message = JSON.parse(String(raw));
    if (message.type === 'ERROR') {
      rejected = true;
      const detail = JSON.stringify(message.data ?? message.message ?? '').replaceAll(key, '[redacted]');
      providerDetail = detail.replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g, '[address-or-secret]').slice(0, 160);
      providerError = /api.?key|origin|auth|unauthoriz/i.test(detail) ? 'authentication-or-origin'
        : /plan|premium|permission|package|quota|credit|limit/i.test(detail) ? 'plan-or-quota'
          : /query|syntax|invalid|charttype|mode/i.test(detail) ? 'subscription-parameters'
            : `unclassified:${detail.replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g, '[address]').slice(0, 160)}`;
      finish('provider-rejected-subscription'); return;
    }
    if (message.type !== 'PRICE_DATA') return;
    const data = message.data;
    if (data?.eventType !== 'ohlcv' || data.address !== mint || data.type !== '1m') return;
    frames += 1;
    if (frames >= 2) finish('received-live-OHLCV');
  } catch { /* A malformed frame is not proof of live OHLCV. */ }
});
socket.on('error', () => finish('websocket-error'));
socket.on('close', () => finish('websocket-closed'));
