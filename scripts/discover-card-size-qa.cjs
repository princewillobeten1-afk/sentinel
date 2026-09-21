// Deterministic presentation-only test. All API calls and WebSockets are mocked.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const baseUrl = process.env.UI_PREVIEW_URL || 'http://127.0.0.1:3002';

async function main() {
  const output = path.join(process.cwd(), 'artifacts', 'discover-card-size');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route('**/*', route => route.request().headers()['next-action']
      ? route.fulfill({ status: 503, contentType: 'text/plain', body: 'UI test: server action unavailable' })
      : route.fallback());
    await context.routeWebSocket('**/ws', socket => socket.close());
    await context.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/discovery/')) {
        const graduated = url.pathname.includes('graduated');
        const tokens = Array.from({ length: 6 }, (_, index) => ({
          mint: `TestMintForLayoutOnly${index}`, name: index === 1 ? 'An extremely long token name that must never displace actions' : 'Ethereum Cat',
          symbol: index === 1 ? 'LONGTOKENNAME' : 'ETHCAT', chain: 'solana', source: 'Pump.fun',
          ageMinutes: 1, priceUsd: '0.0000285', priceChange24h: 14.1, priceChange1h: 4.2, priceChange5m: 14.1,
          marketCapUsd: '55000', liquidityUsd: '18500', volume24hUsd: '220000', volume1hUsd: '25000',
          holdersCount: 5300, proTradersCount: 45, kolsCount: 4, txCount1h: 796, txCount5m: 796, volume5mUsd: '21000',
          buysCount5m: 600, sellsCount5m: 196,
          buysCount1h: 600, sellsCount1h: 196, buysCount: 600, sellsCount: 196,
          bondingCurveProgress: 92, bondingStatus: graduated ? 'graduated' : 'bonding',
          lifecycleState: graduated ? 'migrated' : 'final_stretch', migratedDex: graduated ? 'PumpSwap' : undefined,
          migratedPool: graduated ? 'VerifiedPoolFixture' : undefined, migrationSignature: graduated ? 'MigrationSignatureFixture' : undefined,
          top10HoldingsPct: 15, devHoldingsPct: 0, sniperPercentage: 2, insiderHoldingsPct: 0, bundlerPercentage: 4,
          devMints: 125, devMigrations: 52, isMintRenounced: true, isFreezeDisabled: true,
          isDexPaid: true, isBoosted: true, boostAmount: 50,
          websiteUrl: 'https://example.com', telegramUrl: 'https://t.me/example', twitterUrl: 'https://x.com/example',
          rugRisk: { score: 15, level: 'low', completeness: 'partial', factors: [], version: 'ownership-v2' },
        }));
        return route.fulfill({ json: { success: true, data: { tokens } } });
      }
      return route.fulfill({ status: 503, json: { error: 'Layout test: unavailable' } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const rows = [];
    for (const [width, height] of [[1840, 900], [1440, 900], [1280, 800], [768, 1024], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${baseUrl}/discover`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.locator('.discovery-token-card:visible').first().waitFor({ timeout: 60000 });
      await page.screenshot({ path: path.join(output, `discover-${width}.png`), fullPage: true });
      const measurements = await page.locator('.discovery-token-card:visible').evaluateAll(cards => cards.map(card => {
        const bounds = card.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height, overflow: card.scrollWidth > card.clientWidth + 1 };
      }));
      rows.push({ viewport: width, cards: measurements });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'Page overflow');
      assert.ok(measurements.every(card => !card.overflow), `Card overflow at ${width}`);
      const maxHeight = width >= 1440 ? 192 : width === 768 ? 232 : 212;
      assert.ok(measurements.every(card => card.height <= maxHeight), `Compact card height exceeded at ${width}`);
      const first = page.locator('.discovery-token-card:visible').first();
      const watch = first.getByRole('button', { name: 'Toggle watchlist' });
      await watch.focus();
      await page.keyboard.press('Enter');
      assert.ok(page.url().endsWith('/discover'), 'Watchlist must not navigate');
      await first.getByRole('button', { name: 'Token actions for ETHCAT' }).click();
      await first.getByRole('menu', { name: 'Manage ETHCAT' }).waitFor();
      await first.getByRole('button', { name: 'Token actions for ETHCAT' }).click();
    }
    await fs.writeFile(path.join(output, 'measurements.json'), JSON.stringify({ rows, errors }, null, 2));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(rows.map(row => ({ width: row.viewport, minHeight: Math.min(...row.cards.map(card => card.height)), maxHeight: Math.max(...row.cards.map(card => card.height)) })), null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
