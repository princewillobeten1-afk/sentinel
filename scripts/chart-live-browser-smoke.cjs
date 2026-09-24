// Read-only end-to-end chart check against a running Sentinel server.
const { chromium } = require('playwright');
const mint = process.env.CHART_SMOKE_MINT || 'So11111111111111111111111111111111111111112';
const base = process.env.CHART_SMOKE_BASE_URL || 'http://localhost:3002';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const result = { chartRequests: 0, chartResponses: 0, chartStatuses: [], chartFrames: 0, errors: [], candleCount: 0, status: null };
  page.on('pageerror', error => result.errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/chart?')) result.chartRequests += 1; });
  page.on('response', response => {
    if (response.url().includes('/chart?')) {
      result.chartStatuses.push(response.status());
      if (response.ok()) result.chartResponses += 1;
    }
  });
  page.on('websocket', ws => ws.on('framereceived', frame => {
    try {
      const message = JSON.parse(String(frame.payload));
      if (message.type === 'event' && message.topic === `token.ohlcv:${mint}:15m`
        && message.data?.source === 'birdeye-ohlcv-rest') result.chartFrames += 1;
    } catch { /* Ignore control frames. */ }
  }));
  try {
    await page.goto(`${base}/trade/solana/${mint}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    const chart = page.locator('section[aria-label="Token price chart"]');
    await chart.waitFor({ timeout: 90_000 });
    await chart.locator('canvas').first().waitFor({ timeout: 45_000 });
    await page.waitForTimeout(35_000);
    result.candleCount = Number(await chart.getAttribute('data-candle-count'));
    result.status = await chart.getAttribute('data-chart-status');
    result.errors = result.errors.slice(0, 5);
    console.log(JSON.stringify(result));
    if (result.candleCount < 1 || result.chartResponses < 1 || result.chartFrames < 1 || result.errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(JSON.stringify({ failure: error.message.slice(0, 200) })); process.exitCode = 1; });
