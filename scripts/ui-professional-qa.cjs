// Presentation-only regression: providers and sockets are intercepted; no transactions.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.UI_PREVIEW_URL || 'http://127.0.0.1:3002';

async function main() {
  const output = path.join(process.cwd(), 'artifacts', 'ui-professional');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    // Server Actions POST to the current page, not /api. Block them too so
    // background provider reads cannot serialize ahead of client navigation.
    await context.route('**/*', route => route.request().headers()['next-action']
      ? route.fulfill({ status: 503, contentType: 'text/plain', body: 'UI test: server action unavailable' })
      : route.fallback());
    await context.routeWebSocket('**/ws', socket => socket.close());
    await context.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'UI test: provider unavailable' } }));
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(120000);
    const errors = [];
    const interactionOnly = process.argv.includes('--interactions-only');
    const measurements = interactionOnly ? JSON.parse(await fs.readFile(path.join(output, 'report.json'), 'utf8')).measurements : [];
    page.on('pageerror', error => errors.push({ route: page.url(), message: error.message }));
    for (const route of interactionOnly ? [] : ['terminal', 'portfolio', 'watchlist', 'alerts', 'settings', 'analytics', 'intelligence', 'help', 'developers', 'launchpad', 'ai', 'admin']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${base}/${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.locator('.terminal-shell[data-hydrated="true"]').waitFor({ timeout: 120000 });
      const active = route === 'terminal' ? 'dashboard' : route;
      await page.locator(`[data-active-view="${active}"]`).waitFor({ timeout: 120000 });
      await page.locator(`[data-active-view="${active}"] h1, [data-active-view="${active}"] h2`).first().waitFor({ timeout: 120000 });
      console.log(`Checking ${route}`);
      await page.waitForTimeout(700);
      for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(150);
        const layout = await page.evaluate(() => ({
          viewport: innerWidth, width: document.documentElement.scrollWidth,
          headerWidth: document.querySelector('header')?.scrollWidth,
          overflow: [...document.querySelectorAll('main *')].filter(el => {
            const box = el.getBoundingClientRect();
            return box.right > innerWidth + 1 && box.width > 0 && !el.closest('[class*="overflow-x-auto"]');
          }).slice(0, 5).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.slice(0, 70) })),
        }));
        measurements.push({ route, ...layout });
        await page.screenshot({ path: path.join(output, `${route}-${width}.png`), fullPage: true });
      }
    }
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ measurements, errors, interactions: 'pending' }, null, 2));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/terminal`, { waitUntil: 'domcontentloaded' });
    await page.locator('.terminal-shell[data-hydrated="true"]').waitFor({ timeout: 120000 });
    await page.locator('[data-active-view="dashboard"] h1').waitFor();
    const search = page.getByRole('button', { name: 'Search tokens and commands' });
    await search.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    console.log('Keyboard search passed');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const nav = page.getByRole('dialog');
    await nav.waitFor();
    await nav.getByRole('button', { name: 'Account menu' }).click();
    await page.keyboard.press('Escape');
    assert.equal(await nav.count(), 1, 'Escape closes account popover before navigation drawer');
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await nav.evaluate(el => el.contains(document.activeElement)), 'Focus remains in navigation');
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Open navigation' }).evaluate(el => el === document.activeElement), true);
    console.log('Mobile focus and nested popover passed');
    await page.setViewportSize({ width: 1440, height: 900 });
    const more = page.getByRole('button', { name: 'More', exact: true });
    await more.click();
    await page.getByRole('link', { name: 'Settings', exact: false }).last().click();
    console.log('Settings navigation requested', await page.evaluate(() => ({ url: location.href, activeView: document.querySelector('[data-active-view]')?.getAttribute('data-active-view') })));
    await page.waitForURL('**/settings', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ measurements, errors, interactions: 'passed' }, null, 2));
    const failures = measurements.filter(row => row.width > row.viewport || row.headerWidth > row.viewport);
    console.log(JSON.stringify({ screens: measurements.length, failures, errors }, null, 2));
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, [], 'No page or header horizontal overflow');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
