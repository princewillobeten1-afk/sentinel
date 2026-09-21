/* Visual regression harness. Intercepts API requests; never submits a trade. */
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const baseUrl = process.env.UI_PREVIEW_URL || 'http://127.0.0.1:3002';

const fixtureToken = {
  id: 'qa-token', mint: 'So11111111111111111111111111111111111111112',
  name: 'An Extremely Long Token Name That Must Never Push Actions Off Screen',
  symbol: 'LONGTOKENNAME', chain: 'solana', source: 'Pump.fun',
  priceUsd: '0.0000425', marketCapUsd: '42500', liquidityUsd: '15600', volume24hUsd: '220000',
  ageMinutes: 2, bondingCurveProgress: 92, migrationProgress: 92, bondingStatus: 'bonding',
  holdersCount: 234, holderCount: 234, txCount: 451, buys: 301, sells: 150,
  priceChange24h: 12.5, top10HoldingsPct: 25, devHoldingsPct: 3,
  insiderHoldingsPct: 8, sniperPercentage: 5, bundlerPercentage: 2, devMints: 125,
  devMigrations: 52, isDexPaid: true, isBoosted: true, boostAmount: 50,
};

async function main() {
  const phase = process.argv[2] || 'after';
  let state = process.argv[3] || 'unavailable';
  const output = path.join(process.cwd(), 'artifacts', 'ui-cleanup', `${phase}${state === 'unavailable' ? '' : `-${state}`}`);
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.route('**/*', route => route.request().resourceType() === 'image'
    ? route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="6" fill="#1C2531"/><text x="24" y="30" text-anchor="middle" fill="#98A3B3" font-size="16">QA</text></svg>'})
    : route.fallback());
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (state === 'loading') await new Promise(resolve => setTimeout(resolve, 5000));
    if (state === 'populated' || state === 'empty') {
      if (url.pathname.includes('/discovery/')) {
        const token = url.pathname.includes('graduated')
          ? {...fixtureToken, bondingStatus: 'graduated', lifecycleState: 'migrated', migratedDex: 'Raydium'} : fixtureToken;
        return route.fulfill({json: {success: true, data: {tokens: state === 'empty' ? [] : [token]}}});
      }
      if (/\/tokens\/solana\/[a-zA-Z0-9]+$/.test(url.pathname)) {
        return route.fulfill({json: {success: true, data: {token: fixtureToken}}});
      }
      if (url.pathname === '/api/v1/watchlist') return route.fulfill({json: {success: true, data: {tokens: [], items: []}}});
    }
    return route.fulfill({status: 503, contentType: 'application/json',
      body: JSON.stringify({error: 'QA: provider unavailable'})});
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push({url: page.url(), message: error.message}));
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|did not match|server HTML/i.test(message.text())) console.error(message.text());
  });
  const measurements = [];
  for (const [name, url] of [
    ['overview', '/terminal'], ['discover', '/discover'],
    ['trade', '/trade/solana/So11111111111111111111111111111111111111112'],
  ]) {
    await page.setViewportSize({width:1440, height:900});
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.locator('main').waitFor({ timeout: 60000 });
    await page.locator(name === 'overview' ? '.terminal-overview' : name === 'discover' ? '.discovery-workspace' : '.terminal-trade').waitFor({ timeout: 60000 });
    if (state === 'populated' && name !== 'trade') {
      await page.locator(name === 'overview' ? '.terminal-token-card:visible' : '.discovery-token-card:visible').first().waitFor({ timeout: 60000 });
    }
    await page.waitForTimeout(1800);
    for (const [width, height] of [[1440,900], [1280,800], [768,1024], [390,844]]) {
      await page.setViewportSize({width, height});
      await page.waitForTimeout(250);
      // Dev chunk refreshes can briefly show the shell fallback after resize.
      await page.locator(name === 'overview' ? '.terminal-overview' : name === 'discover' ? '.discovery-workspace' : '.terminal-trade').waitFor({timeout: 60000});
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true });
      const metrics = { name, width, height, ...await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        footerBottom: document.querySelector('footer')?.getBoundingClientRect().bottom,
      })) };
      measurements.push(metrics);
      if (phase === 'after') {
        assert.equal(metrics.documentWidth, width, `${name}: horizontal page overflow at ${width}`);
        if (name === 'discover') assert.equal(metrics.documentHeight, height, 'Discovery must fit viewport');
        if (name === 'trade') {
          const rail = await page.locator('.terminal-trade-order').boundingBox();
          if (width >= 1280) assert.equal(Math.round(rail.width), 320, 'Desktop order rail');
          else {
            const chart = await page.locator('.terminal-trade-chart').boundingBox();
            const details = await page.locator('.terminal-trade-details').boundingBox();
            assert.ok(chart.y < rail.y && rail.y < details.y, 'Mobile trade order');
          }
        }
      }
    }
  }
  if (phase === 'after' && state === 'populated') {
    await page.setViewportSize({width:1440, height:900});
    await page.goto(`${baseUrl}/discover`);
    await page.locator('.discovery-token-card').first().waitFor();
    await page.getByRole('button', {name:'Collapse sidebar'}).click();
    await page.getByRole('button', {name:'Expand sidebar'}).click();
    await page.getByRole('button', {name:'Search tokens and commands'}).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.notEqual(await page.getByRole('button', {name:'Search tokens and commands'}).evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'Keyboard focus must be visible');
    await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('dialog').count(), 1, 'Keyboard opens search');
    await page.keyboard.press('Escape');
    await page.getByRole('button', {name:'Filters', exact:true}).click();
    await page.getByRole('dialog', {name:'Advanced Discovery Filters'}).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', {name:'Advanced Discovery Filters'}).count(), 0);
    const card = page.locator('.discovery-token-card').first();
    const watch = card.getByRole('button', {name: 'Toggle watchlist'});
    await watch.focus();
    await page.keyboard.press('Enter');
    assert.ok(page.url().endsWith('/discover'), 'Nested watchlist action must not open Trade');
    await page.getByRole('button', {name:'Quick Trade', exact:true}).click();
    await page.screenshot({path: path.join(output, 'quick-trade-open.png')});
    await page.keyboard.press('Escape');
    await page.goto(`${baseUrl}/trade/solana/So11111111111111111111111111111111111111112`);
    await page.locator('.terminal-trade-details').waitFor();
    for (const name of ['Positions', 'Orders', 'Trades']) {
      await page.locator('.terminal-trade-details').getByRole('button', {name: new RegExp(`^${name}`)}).first().click();
    }
    await page.goto(`${baseUrl}/discover`);
    await page.setViewportSize({width:390, height:844});
    await page.getByRole('button', {name:'Open navigation'}).click();
    await page.getByRole('button', {name:'Close drawer'}).click();
    const mobileSearch = await page.getByRole('button', {name:'Search tokens and commands'}).boundingBox();
    assert.ok(mobileSearch.height >= 44, 'Mobile search touch target');
    assert.ok(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'Reduced motion enabled');
    await page.getByRole('button', {name:'Final Stretch', exact:true}).click();
    assert.equal(await page.getByRole('button', {name:'Final Stretch', exact:true}).getAttribute('aria-pressed'), 'true');
    state = 'empty';
    await page.reload();
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('.discovery-token-card').count(), 0);
    await page.screenshot({path: path.join(output, 'discover-empty-390.png')});
    state = 'loading';
    await page.reload({waitUntil:'domcontentloaded'});
    await page.screenshot({path: path.join(output, 'discover-loading-390.png')});
    console.log('Navigation, search, filters, watchlist, quick trade, mobile columns, empty/loading checks passed.');
  }
  await fs.writeFile(path.join(output, 'measurements.json'), JSON.stringify({measurements, errors}, null, 2));
  console.log(JSON.stringify({output, measurements, errors}, null, 2));
  await browser.close();
  assert.equal(errors.length, 0, 'Browser should not produce runtime or hydration errors');
}
main().catch(error => { console.error(error); process.exit(1); });
