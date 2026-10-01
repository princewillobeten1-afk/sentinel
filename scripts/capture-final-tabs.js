const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = 'C:\\Users\\HomePC\\.gemini\\antigravity-ide\\brain\\9ab7d1c6-f925-4b52-aa83-63eb932af7d4';

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  console.log('Navigating to BONK Intelligence Report...');
  const reportResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/intelligence/solana/') && resp.status() === 200,
    { timeout: 45000 }
  ).catch(() => null);

  await page.goto('http://localhost:3000/intelligence/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });

  await reportResponsePromise;
  await page.waitForTimeout(2000);

  // 1. Activity Quality
  console.log('Testing Activity Quality tab...');
  await page.evaluate(() => window.scrollTo(0, 350));
  await page.locator('button[data-tab-id="activity"]').click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);
  const screenActivity = path.join(OUT_DIR, '08_bonk_activity.png');
  await page.screenshot({ path: screenActivity, fullPage: false });
  console.log('Saved:', screenActivity);

  // 2. Audit Evidence
  console.log('Testing Audit Evidence tab...');
  await page.evaluate(() => window.scrollTo(0, 350));
  await page.locator('button[data-tab-id="evidence"]').click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);
  const screenEvidence = path.join(OUT_DIR, '09_bonk_evidence.png');
  await page.screenshot({ path: screenEvidence, fullPage: false });
  console.log('Saved:', screenEvidence);

  await browser.close();
  console.log('Done!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
