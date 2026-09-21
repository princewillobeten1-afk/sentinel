// Browser regression using deterministic API fixtures; all mutations are blocked.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.UI_PREVIEW_URL || 'http://127.0.0.1:3002';
const now = Date.now();
const baseToken = (mint, ageMinutes = 1) => ({
  id: mint, mint, name: mint, symbol: mint, chain: 'solana', source: 'Pump.fun', ageMinutes,
  priceUsd: '0.0001', marketCapUsd: '90000', liquidityUsd: '15000', volume5mUsd: '5000',
  priceChange5m: 2, buysCount5m: 5, sellsCount5m: 2, txCount5m: 7,
});
const proofToken = (mint, ageMinutes, migratedAt) => ({
  ...baseToken(mint, ageMinutes), lifecycleState: 'migrated', bondingStatus: 'graduated',
  migratedAt, migratedDex: 'PumpSwap', migratedPool: `pool-${mint}`, migrationSignature: `proof-${mint}`,
});
async function main() {
  const output = path.join(process.cwd(), 'artifacts/discover-lifecycle');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844]]) {
      let phase = 0;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      await context.route('**/*', route => route.request().headers()['next-action']
        ? route.fulfill({ status: 503, body: 'Test blocks mutations' }) : route.fallback());
      await context.routeWebSocket('**/ws', socket => socket.close());
      await context.route('**/api/**', route => {
        const section = new URL(route.request().url()).pathname.split('/').pop();
        let tokens;
        if (section === 'new') tokens = [baseToken('NEWPAIR')];
        if (section === 'migrating') tokens = phase ? [] : [{ ...baseToken('NEARCURVE'),
          lifecycleState: 'final_stretch', bondingStatus: 'bonding', bondingCurveProgress: 98.5,
          lifecycleEvidence: { status: 'measured', source: 'solana-bonding-curve', observedAt: new Date(now).toISOString() } }];
        // Deliberately return the opposite of migration-time order. Launch age
        // must not move the older migration above the recently migrated token.
        if (section === 'graduated') tokens = [proofToken('OLDEREVENT', 1, now - 60_000),
          proofToken('RECENTEVENT', 10000, now - 10_000), ...(phase ? [proofToken('NEARCURVE', 10, now)] : [])];
        return tokens ? route.fulfill({ json: { success: true, data: { tokens } } })
          : route.fulfill({ status: 503, json: { error: 'Unavailable in test' } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/discover`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.locator('[data-hydrated="true"]').waitFor({ timeout: 60000 });
      const select = async (title) => {
        if (width < 768) await page.getByRole('button', { name: title, exact: true }).click();
        return page.locator('.discovery-column:visible').filter({ hasText: title.toUpperCase() }).first();
      };
      const final = await select('Final Stretch');
      await final.getByText('98.5%', { exact: true }).waitFor();
      assert.ok((await final.innerText()).includes('Bonding curve'), '98% is still a curve, not a migration');
      let graduated = await select('Migrated');
      await graduated.locator('.discovery-token-card').first().waitFor();
      assert.ok((await graduated.locator('.discovery-token-card').first().innerText()).includes('RECENTEVENT'));
      assert.ok(!(await graduated.locator('.discovery-token-card').first().innerText()).includes('6d'), 'Migration age must not show token launch age');
      await graduated.locator('[title^="Since confirmed migration"]').first().waitFor();
      assert.equal(await graduated.getByRole('link', { name: 'Verify migration transaction on Solscan' }).first().getAttribute('href'),
        'https://solscan.io/tx/proof-RECENTEVENT');
      phase = 1;
      await graduated.getByTitle('Refresh Column').click();
      await graduated.locator('.discovery-token-card').filter({ hasText: 'NEARCURVE' }).waitFor();
      graduated = await select('Migrated');
      assert.ok((await graduated.locator('.discovery-token-card').first().innerText()).includes('NEARCURVE'));
      const emptied = await select('Final Stretch');
      await emptied.getByText('Nothing near migration', { exact: true }).waitFor();
      await select('Migrated');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(output, `discover-${width}.png`), fullPage: true });
      results.push({ width, passed: true, checks: ['curve status', 'migration time order', 'proof link', 'transition', 'no overflow', 'no page errors'] });
      await context.close();
    }
    await fs.writeFile(path.join(output, 'browser-report.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
