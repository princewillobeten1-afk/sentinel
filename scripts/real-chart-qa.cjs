// Isolated browser regression. All APIs and WebSockets are fixtures; no orders or transactions.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const mint = 'So11111111111111111111111111111111111111112';
const seconds = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
async function main() {
  const output = path.join(process.cwd(), 'artifacts', 'real-chart');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const errors = [], blocked = [], requests = [], checks = [];
    let mode = 'measured', activeSocket, topic, sequence = 0;
    const token = { mint, id: mint, name: 'Real Chart Verification Token', symbol: 'CHART', chain: 'solana',
      priceUsd: '0.000000025', marketCapUsd: '10000', liquidityUsd: '9000', volume24hUsd: '20000', priceChange24h: 12 };
    const candle = (time, i = 0) => ({ time, open: 0.00000002 + i * 0.00000000001, high: 0.00000003 + i * 0.00000000001,
      low: 0.000000015 + i * 0.00000000001, close: 0.000000025 + i * 0.00000000001, volume: 1000 + i, volumeUsd: 0.01 });
    await context.route('**/*', route => {
      if (route.request().headers()['next-action']) return route.fulfill({ status: 403, body: 'QA blocks Server Actions' });
      if (route.request().resourceType() === 'image') return route.abort();
      return route.fallback();
    });
    await context.route('**/api/**', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') { blocked.push(url.pathname); return route.fulfill({ status: 403, json: { success: false } }); }
      if (url.pathname.endsWith('/chart')) {
        const tf = url.searchParams.get('timeframe'), before = Number(url.searchParams.get('before'));
        requests.push({ tf, before, mode });
        if (mode === 'error') return route.fulfill({ status: 503, json: { success: false, error: { message: 'Candle provider unavailable (QA).' } } });
        const end = before ? before - seconds[tf] : Math.floor(Date.now() / 1000 / seconds[tf]) * seconds[tf];
        const candles = mode === 'empty' ? [] : Array.from({ length: 50 }, (_, i) => candle(end - (49 - i) * seconds[tf], i));
        return route.fulfill({ json: { success: true, data: { address: mint, chain: 'solana', timeframe: tf, currency: 'usd', market: 'token-aggregate',
          source: 'birdeye-ohlcv-v3', status: mode === 'stale' ? 'stale' : 'measured', reason: mode === 'stale' ? 'Provider delayed (QA).' : undefined,
          observedAt: Date.now(), candles, hasMore: !before && mode !== 'empty', oldestTime: candles[0]?.time ?? null } } });
      }
      if (url.pathname.endsWith('/card') || url.pathname === `/api/v1/tokens/solana/${mint}`)
        return route.fulfill({ json: { success: true, data: { token } } });
      return route.fulfill({ status: 503, json: { success: false } });
    });
    await context.routeWebSocket('**/ws*', socket => {
      activeSocket = socket;
      socket.onMessage(raw => {
        const message = JSON.parse(String(raw));
        if (message.type === 'subscribe') {
          topic = message.topics?.find(t => t.startsWith('token.ohlcv:')) || topic;
          socket.send(JSON.stringify({ type: 'subscribed', topics: message.topics }));
        }
      });
      socket.send(JSON.stringify({ type: 'welcome', connectionId: 'qa', maxSubscriptions: 100 }));
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.UI_PREVIEW_URL || 'http://127.0.0.1:3002'}/trade/solana/${mint}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByText(token.name, { exact: true }).first().waitFor({ timeout: 45000 });
    const chart = page.getByRole('region', { name: 'Token price chart', exact: true });
    await chart.locator('[data-testid="chart-ohlcv"]').getByText('Vol:', { exact: false }).waitFor({ timeout: 30000 });
    assert.equal(await chart.getAttribute('data-chart-status'), 'Polling');
    assert.equal(await chart.locator('canvas').count() > 0, true);
    assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
    console.log('Dev server verified: real chart canvas, controls and fallback status render; no error overlay.');
    const before = await chart.getByTestId('chart-ohlcv').innerText();
    await page.waitForTimeout(1800);
    assert.equal(await chart.getByTestId('chart-ohlcv').innerText(), before, 'No random micro ticks');
    for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844]]) {
      await page.setViewportSize({ width, height }); await chart.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `chart-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `Overflow at ${width}`);
      checks.push({ width, height, overflow: false });
    }
    await chart.getByRole('button', { name: 'Load older candles', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-candle-count]')?.getAttribute('data-candle-count') === '100');
    await chart.getByRole('button', { name: 'Refresh chart', exact: true }).click();
    await chart.getByRole('button', { name: 'Refresh chart', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await chart.getAttribute('data-candle-count'), '100');
    await chart.getByRole('button', { name: '1m', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-candle-count]')?.getAttribute('data-candle-count') === '50');
    assert.ok(requests.some(r => r.tf === '1m'));
    // Send a full cumulative candle at the selected interval, then an older sequence.
    assert.ok(topic?.endsWith(':1m'), `Expected selected chart subscription, received ${topic}`);
    const live = { ...candle(Math.floor(Date.now() / 60000) * 60), close: 0.000000029, volume: 12345 };
    activeSocket.send(JSON.stringify({ type: 'event', topic, sequence: ++sequence,
      data: { address: mint, timeframe: '1m', candle: live, observedAt: Date.now() + 1, source: 'birdeye-price-ws' } }));
    await page.waitForFunction(() => document.querySelector('[data-chart-status]')?.getAttribute('data-chart-status') === 'Live');
    assert.ok((await chart.getByTestId('chart-ohlcv').innerText()).includes('12,345'));
    activeSocket.send(JSON.stringify({ type: 'event', topic, sequence: 0,
      data: { address: mint, timeframe: '1m', candle: { ...live, volume: 1 }, observedAt: Date.now(), source: 'birdeye-price-ws' } }));
    await chart.screenshot({ path: path.join(output, 'chart-live.png') });
    assert.ok((await chart.getByTestId('chart-ohlcv').innerText()).includes('12,345'));
    mode = 'empty'; await chart.getByRole('button', { name: '5m', exact: true }).click();
    await chart.getByText('No indexed candles yet. Waiting for trades.', { exact: true }).waitFor();
    mode = 'error'; await chart.getByRole('button', { name: 'Retry chart', exact: true }).click();
    await chart.getByRole('alert').waitFor();
    await chart.screenshot({ path: path.join(output, 'chart-error.png') });
    mode = 'measured'; await chart.getByRole('button', { name: 'Retry chart', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-candle-count]')?.getAttribute('data-candle-count') === '50');
    mode = 'stale'; await chart.getByRole('button', { name: 'Refresh chart', exact: true }).click();
    await chart.getByRole('alert').waitFor();
    assert.equal(await chart.getAttribute('data-chart-status'), 'Delayed');
    await chart.screenshot({ path: path.join(output, 'chart-stale.png') });
    await chart.getByRole('button', { name: 'Zoom in', exact: true }).focus();
    assert.equal(await chart.getByRole('button', { name: 'Zoom in', exact: true }).evaluate(e => e === document.activeElement), true);
    assert.deepEqual(errors, []);
    assert.equal(blocked.some(p => /prepare|submit|execute/.test(p)), false);
    const result = { passed: true, checks, requests, errors, blockedRequests: blocked, fixtureWebsocket: true, liveProviderProof: 'provider-smoke.json' };
    await fs.writeFile(path.join(output, 'browser-verification.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); console.error((await page.locator('body').innerText()).slice(-2500)); }
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
