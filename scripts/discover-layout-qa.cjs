// Presentation regression only: synthetic fixtures never reach a provider or execution API.
const { chromium } = require('playwright');
const { PublicKey } = require('@solana/web3.js');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.UI_PREVIEW_URL || 'http://127.0.0.1:3002';
const output = path.join(process.cwd(), 'artifacts/ui-audit');

function fixtures(section) {
  return Array.from({ length: 20 }, (_, i) => {
    const state = ['measured', 'loading', 'stale', 'unavailable'][i % 4];
    const evidence = { status: state, source: 'UI test fixture', observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
    const known = state === 'measured' || state === 'stale';
    return {
      id: `${section}-${i}`, mint: new PublicKey(new Uint8Array(32).fill(i + 1 + (section === 'graduated' ? 50 : section === 'migrating' ? 25 : 0))).toBase58(),
      symbol: i === 4 ? 'VERYLONGTOKENSYMBOL' : ['AURORA', 'ORBIT', 'NOVA', 'LUNA'][i % 4],
      name: i === 4 ? 'A deliberately long token name to verify truncation and protected action space' : ['Aurora Network', 'Orbit protocol', 'Nova Labs', 'Luna community'][i % 4],
      chain: 'solana', source: 'Pump.fun', ageMinutes: i + 0.3,
      priceUsd: '0.0000482', marketCapUsd: '48200', liquidityUsd: '12500', liquidityPoolAddress: i === 3 ? undefined : 'test-pool',
      volume5mUsd: '3400', volume1hUsd: '9200', volume24hUsd: '148200', priceChange5m: 4.3,
      txCount5m: 127, buysCount5m: 79, sellsCount5m: 48,
      bondingStatus: section === 'graduated' ? 'graduated' : 'bonding', lifecycleState: section === 'graduated' ? 'migrated' : 'bonding',
      bondingCurveProgress: section === 'graduated' ? 100 : section === 'migrating' ? 86 + i / 2 : 12 + i,
      migratedDex: section === 'graduated' ? 'PumpSwap' : undefined, migratedAt: section === 'graduated' ? Date.now() - i * 60000 : undefined,
      holdersCount: known ? 312 : undefined, top10HoldingsPct: known ? 22 : undefined, devHoldingsPct: known ? 2 : undefined,
      sniperPercentage: known ? 1 : undefined, insiderHoldingsPct: known ? 6 : undefined, bundlerPercentage: known ? 8 : undefined,
      proTradersCount: known ? 4 : undefined, kolsCount: known ? 1 : undefined,
      devMints: 17, devMigrations: 3, devWalletAge: known ? '2d' : undefined,
      twitterHandle: '@aurora_test', twitterUrl: 'https://x.com/aurora_test', websiteUrl: 'https://example.com',
      isMintRenounced: known ? true : undefined, isFreezeDisabled: known ? true : undefined,
      marketEvidence: evidence, ownershipEvidence: evidence, securityEvidence: evidence,
      auditPending: state === 'loading', rugRisk: known ? { score: 32, level: 'medium', completeness: 'partial', factors: ['UI test evidence'], version: 'test' } : undefined,
    };
  });
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = { screens: [], errors: [], interactions: [] };
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.routeWebSocket('**/ws', socket => socket.close());
    await context.route('**/*', route => route.request().headers()['next-action']
      ? route.fulfill({ status: 503, body: 'UI test: server actions disabled' }) : route.fallback());
    let mode = 'populated';
    await context.route('**/api/**', async route => {
      const u = new URL(route.request().url());
      if (u.pathname.startsWith('/api/v1/discovery/')) {
        if (mode === 'error') return route.fulfill({ status: 503, json: { error: 'UI test outage' } });
        if (mode === 'loading') await new Promise(resolve => setTimeout(resolve, 4000));
        const section = u.pathname.split('/').pop();
        return route.fulfill({ json: { success: true, data: { tokens: mode === 'empty' ? [] : fixtures(section) } } });
      }
      return route.fulfill({ status: 503, json: { error: 'UI test: external services disabled' } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/discover`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.locator('.discovery-token-card').first().waitFor();
    for (const [width, height] of [[1840,900], [1440,900], [1280,800], [768,1024], [390,844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(350);
      await page.locator('[data-discovery-scroll]').evaluateAll(nodes => nodes.forEach(n => n.scrollTop = 0));
      const layout = await page.evaluate(() => ({
        width: innerWidth, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
        columns: document.querySelectorAll('.discovery-column').length,
        cardHeight: document.querySelector('.discovery-token-card')?.getBoundingClientRect().height,
        feedHeight: document.querySelector('[data-discovery-scroll]')?.getBoundingClientRect().height,
        clippedActions: [...document.querySelectorAll('.discovery-token-card')].filter(card => {
          const bounds = card.getBoundingClientRect();
          return [...card.querySelectorAll('button')].some(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.left < bounds.left - 1 || r.right > bounds.right + 1); });
        }).length,
      }));
      assert.equal(layout.documentWidth, width, 'No page horizontal overflow');
      assert.equal(layout.documentHeight, height, 'Discover fits viewport');
      assert.equal(layout.columns, width < 768 ? 1 : 3, 'No hidden duplicate feeds mounted');
      assert.equal(layout.clippedActions, 0, 'Actions remain within the card');
      await page.screenshot({ path: path.join(output, `discover-fixture-${width}.png`) });
      report.screens.push(layout);
    }
    for (const tab of ['Final Stretch', 'Migrated', 'New Pairs']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.locator('.discovery-token-card').first().waitFor();
      assert.equal(await page.locator('.discovery-column').count(), 1);
    }
    report.interactions.push('Mobile column tabs');
    await page.getByTitle('Configure Quick Buy Amounts').click();
    await page.getByRole('dialog', { name: 'Quick Buy Settings' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', { name: 'Quick Buy Settings' }).count(), 0);
    report.interactions.push('Quick Buy preferences: focus / Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Safety details for AURORA', exact: true }).first().click();
    await page.getByRole('region', { name: 'Security evidence for AURORA' }).first().waitFor();
    report.interactions.push('Security evidence expansion');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    report.interactions.push('Filters drawer');
    await page.getByRole('button', { name: 'Search tokens and commands' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    report.interactions.push('Keyboard search');
    for (const next of ['empty', 'error', 'loading']) {
      mode = next;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.discovery-workspace').waitFor();
      if (next === 'empty') await page.getByText('Nothing here yet').waitFor();
      if (next === 'error') await page.getByText('Feed Unavailable').first().waitFor();
      await page.screenshot({ path: path.join(output, `discover-state-${next}.png`) });
    }
    assert.deepEqual(report.errors, []);
  } finally {
    await fs.writeFile(path.join(output, 'discover-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
