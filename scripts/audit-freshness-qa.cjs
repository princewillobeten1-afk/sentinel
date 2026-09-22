/* Read-only UI regression: intercept every API and block Server Actions/transactions. */
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const mint = 'So11111111111111111111111111111111111111112';

async function main() {
  const output = path.join(process.cwd(), 'artifacts', 'audit-freshness');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    let mode = 'pending', auditRequests = 0;
    const errors = [], mutations = [], checks = [];
    const evidence = () => ({ source: 'QA fixture', status: mode === 'stale' ? 'stale' : 'measured',
      observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const token = { mint, id: mint, name: 'Audit Verification Token', symbol: 'AUDIT', chain: 'solana', priceUsd: '0.001',
      marketCapUsd: '10000', liquidityUsd: '9000', volume24hUsd: '20000', priceChange24h: 12 };
    function audit() {
      const value = mode === 'pending' ? null : 2;
      const data = { token: mint, chain: 'solana', mintAuthorityDisabled: mode === 'pending' ? null : true,
        freezeAuthorityDisabled: mode === 'pending' ? null : true, lpTokensBurned: null, honeypotTaxZero: null,
        top10HoldersPct: value, devBalancePct: value, organicScore: value, organicScoreLabel: 'high', devMints: 10,
        devMigrations: null, migrationRatePct: null, snipersPct: value, insidersPct: value, bundlersPct: value,
        holderTop10Pct: value, totalHolders: value, holderAuditPending: mode === 'pending',
        rugRisk: mode === 'pending' ? null : { score: 0, level: 'low', completeness: 'complete', factors: [], version: 'test' } };
      for (const key of ['marketEvidence', 'ownershipEvidence', 'securityEvidence', 'creatorEvidence', 'lifecycleEvidence',
        'liquidityEvidence', 'top10Evidence', 'devBalanceEvidence', 'mintAuthorityEvidence', 'freezeAuthorityEvidence', 'organicEvidence', 'historyEvidence']) {
        data[key] = mode === 'pending' ? { ...evidence(), status: 'loading' } : evidence();
      }
      return data;
    }
    await context.route('**/*', route => {
      if (route.request().headers()['next-action']) return route.fulfill({ status: 503, body: 'QA blocks Server Actions' });
      if (route.request().resourceType() === 'image') return route.abort();
      return route.fallback();
    });
    await context.route('**/api/**', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') {
        // Focus is telemetry, but is still intercepted and never reaches the server.
        if (!url.pathname.endsWith('/focus')) mutations.push(url.pathname);
        return route.fulfill({ status: 403, json: { success: false } });
      }
      if (url.pathname.endsWith('/audit')) {
        auditRequests++;
        return mode === 'error' ? route.fulfill({ status: 503, json: { success: false } })
          : route.fulfill({ json: { success: true, data: audit() } });
      }
      if (url.pathname.endsWith('/card') || url.pathname === `/api/v1/tokens/solana/${mint}`)
        return route.fulfill({ json: { success: true, data: { token } } });
      return route.fulfill({ status: 503, json: { success: false } });
    });
    await context.routeWebSocket('**/ws*', socket => socket.close());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.UI_PREVIEW_URL || 'http://127.0.0.1:3002'}/trade/solana/${mint}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: /Sentinel.*Audit|Token Audit|^Audit$/i }).first().click({ timeout: 120000 });
    const panel = page.getByRole('region', { name: 'Token audit', exact: true });
    await panel.getByText('Ownership audit queued', { exact: false }).waitFor();
    assert.ok((await panel.innerText()).includes('Not verified'));
    mode = 'measured';
    await panel.getByText('Risk 0 · low', { exact: true }).waitFor({ timeout: 15000 });
    assert.ok(auditRequests >= 2, 'Pending audit automatically reconciled');
    assert.ok((await panel.innerText()).includes('?/10 reached a pool'), 'Missing migration count is not zero');
    for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `audit-${width}.png`), fullPage: true });
      const actual = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.equal(actual, width, `Page overflow at ${width}`);
      checks.push({ width, height, overflow: false });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    mode = 'stale';
    await panel.getByRole('button', { name: 'Refresh audit', exact: true }).click();
    await panel.getByText('Risk 0 · stale', { exact: true }).waitFor();
    assert.equal(await panel.locator('.text-emerald-400').count(), 0, 'Stale audit values must not remain green');
    await panel.screenshot({ path: path.join(output, 'audit-stale.png') });
    mode = 'error';
    await panel.getByRole('button', { name: 'Refresh audit', exact: true }).click();
    await panel.getByRole('alert').waitFor();
    assert.ok((await panel.getByRole('alert').innerText()).includes('503'));
    await panel.screenshot({ path: path.join(output, 'audit-error.png') });
    mode = 'measured';
    await panel.getByRole('button', { name: 'Refresh audit', exact: true }).click();
    await panel.getByText('Risk 0 · low', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, []);
    const result = { passed: true, checks, auditRequests, errors, mutations, output };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
