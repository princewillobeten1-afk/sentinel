// Read-only live UI smoke check. No fixtures, wallet connection or transactions.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const mint = 'So11111111111111111111111111111111111111112';
async function main() {
  const browser = await chromium.launch({ headless: true });
  const output = path.join(process.cwd(), 'artifacts', 'intelligence');
  await fs.mkdir(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [], responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', async response => {
      if (!new URL(response.url()).pathname.startsWith('/api/v1/intelligence/')) return;
      const data = await response.json().catch(() => null);
      responses.push({ path: new URL(response.url()).pathname, status: response.status(), coverage: data?.data?.coverage, code: data?.error?.code });
    });
    await page.goto((process.env.UI_PREVIEW_URL || 'http://localhost:3000') + '/intelligence/solana/' + mint, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('heading', { name: 'Ownership', exact: true }).waitFor({ timeout: 40000 });
    await page.getByRole('button', { name: 'Load observations' }).click();
    await page.getByText('ownership observed', { exact: true }).first().waitFor({ timeout: 30000 });
    await page.evaluate(() => { document.activeElement?.blur(); document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo({top: 0, behavior: 'instant'}); });
    await page.waitForFunction(() => window.scrollY === 0);
    await page.screenshot({ path: path.join(output, 'live-sol-report.png'), fullPage: true });
    const result = { live: true, responses, errors, hasEvidence: responses.some(r => r.coverage?.measured > 0) };
    await fs.writeFile(path.join(output, 'live-report.json'), JSON.stringify(result, null, 2));
    if (!result.hasEvidence || errors.length) throw new Error('Live smoke check failed: ' + JSON.stringify(result));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
