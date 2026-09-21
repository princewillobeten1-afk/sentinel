/* Deterministic local UI verification. All APIs are intercepted; no transactions. */
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const mint = 'So11111111111111111111111111111111111111112';
const base = process.env.UI_PREVIEW_URL || 'http://127.0.0.1:3002';

async function main() {
  const output = path.join(process.cwd(), 'artifacts', 'trade-sidebar');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route('**/*', route => route.request().headers()['next-action']
      ? route.fulfill({ status: 503, contentType: 'text/plain', body: 'UI test: server action unavailable' })
      : route.fallback());
    const errors = [], submissions = [], measurements = [];
    let state = 'populated';
    const evidence = { source: 'QA fixture', status: 'measured', observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString() };
    const token = { mint, id: mint, name: 'Long Token Name For Responsive Verification', symbol: 'LONGTOKENNAME', chain: 'solana', priceUsd: '0.00001',
      marketCapUsd: '10000', liquidityUsd: '9000', volume24hUsd: '20000', priceChange24h: 12,
      holdersCount: 3127, top10HoldingsPct: 0.76, devHoldingsPct: 0, sniperPercentage: 0.05, insiderHoldingsPct: 99.36, bundlerPercentage: 98.1,
      proTradersCount: 0, isDexPaid: false, buyVolume5mUsd: 318.4, sellVolume5mUsd: 200.2, buysCount5m: 56, sellsCount5m: 53,
      devAddress: mint, devWalletAge: '13m', ownershipEvidence: evidence, lpLockedPct: null };
    await context.route('**/*', route => route.request().resourceType() === 'image' ? route.abort() : route.fallback());
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/v1/market/live/focus') return route.fulfill({ json: { success: true, data: {} } });
      if (request.method() !== 'GET' && url.pathname !== '/api/v1/trading/quote') {
        submissions.push(url.pathname); return route.fulfill({ status: 403, json: { error: 'QA blocks writes' } });
      }
      if (url.pathname === '/api/v1/trading/quote') return route.fulfill({ json: { data: { quote: { id: 'fixture', outputAmount: '2450', minimumReceived: '2420', priceImpact: 0.2, networkFeeSol: '0.000005', provider: 'QA', isValid: true } } } });
      if (url.pathname.endsWith('/card')) {
        if (state === 'unavailable') return route.fulfill({ status: 503, json: { error: 'QA unavailable' } });
        return route.fulfill({ json: { data: { token: state === 'pending' ? { mint } : state === 'stale' ? { ...token, ownershipEvidence: { ...evidence, status: 'stale', expiresAt: '2020-01-01T00:00:00Z' } } : token } } });
      }
      if (url.pathname === `/api/v1/tokens/solana/${mint}`) return route.fulfill({ json: { data: { token } } });
      return route.fulfill({ status: 503, json: { error: 'QA unavailable' } });
    });
    await context.routeWebSocket('**/ws*', socket => socket.close());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/trade/solana/${mint}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const rail = page.getByRole('region', { name: 'Token order panel', exact: true });
    await rail.waitFor({ timeout: 120000 });
    await page.getByText('Est. receive 2,450', { exact: false }).waitFor({ timeout: 30000 }).catch(() => {});
    for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `trade-${width}.png`), fullPage: true });
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      assert.equal(layout.width, width, `Page overflow at ${width}`);
      measurements.push({ ...layout, rail: await rail.boundingBox() });
      // A tall capture avoids the sticky site header covering the top of a
      // taller-than-viewport rail during Playwright's element auto-scroll.
      await page.setViewportSize({ width, height: 2400 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await rail.screenshot({ path: path.join(output, `rail-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await rail.getByRole('button', { name: '0.01', exact: true }).click();
    assert.equal(await page.getByLabel('Amount', { exact: true }).inputValue(), '0.01');
    await rail.getByRole('button', { name: 'Sell', exact: true }).click();
    assert.equal(await rail.getByRole('button', { name: '50%' }).isDisabled(), true);
    await rail.getByRole('button', { name: 'Limit', exact: true }).click();
    await page.getByRole('dialog', { name: 'Create Intelligent Limit Order' }).waitFor();
    await page.keyboard.press('Escape');
    await rail.getByLabel('Advanced Trading Strategy').check();
    await rail.getByRole('button', { name: 'Add strategy' }).click();
    await page.getByRole('dialog', { name: 'Create Intelligent Limit Order' }).waitFor();
    await page.keyboard.press('Escape');
    await rail.getByLabel('Advanced Trading Strategy').uncheck();
    await rail.getByRole('button', { name: 'Make a callout', exact: false }).click();
    assert.ok((await page.getByLabel('Callout draft').inputValue()).includes(mint));
    await page.keyboard.press('Escape');
    await rail.getByRole('button', { name: 'Edit amount presets' }).click();
    await page.getByLabel('Four buy amounts (SOL)').fill('0.2, 0.4, 0.8, 2');
    await page.getByRole('button', { name: 'Save preset' }).click();
    await rail.getByRole('button', { name: 'Buy', exact: true }).click();
    await rail.getByRole('button', { name: '0.4', exact: true }).click();
    assert.equal(await page.getByLabel('Amount', { exact: true }).inputValue(), '0.4');
    for (state of ['pending', 'stale', 'unavailable']) {
      await rail.getByRole('button', { name: 'Refresh token information' }).click();
      await page.waitForTimeout(500);
      await page.setViewportSize({ width: 1440, height: 2400 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await rail.screenshot({ path: path.join(output, `rail-${state}.png`) });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(submissions, []);
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ measurements, errors, submissions }, null, 2));
    console.log(JSON.stringify({ passed: true, sizes: measurements.length, errors, submissions, output }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
