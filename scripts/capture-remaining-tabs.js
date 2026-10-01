const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = 'C:\\Users\\HomePC\\.gemini\\antigravity-ide\\brain\\9ab7d1c6-f925-4b52-aa83-63eb932af7d4';

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  console.log('Navigating to BONK Intelligence Report...');
  await page.goto('http://localhost:3000/intelligence/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await page.waitForSelector('text=AI Sentinel Verdict', { timeout: 25000 });
  await page.waitForTimeout(1000);

  // 1. Supply & Ownership
  const supplyTab = page.locator('button:has-text("Supply & Ownership")');
  console.log('Clicking Supply tab...');
  await supplyTab.first().click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);
  const screen6Path = path.join(OUT_DIR, '06_bonk_supply_ownership.png');
  await page.screenshot({ path: screen6Path, fullPage: false });
  console.log('Saved:', screen6Path);

  // 2. Creator Track Record
  const creatorTab = page.locator('button:has-text("Creator Track Record")');
  console.log('Clicking Creator tab...');
  await creatorTab.first().click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);
  const screen7Path = path.join(OUT_DIR, '07_bonk_creator.png');
  await page.screenshot({ path: screen7Path, fullPage: false });
  console.log('Saved:', screen7Path);

  // 3. Activity Quality
  const activityTab = page.locator('button:has-text("Activity Quality")');
  console.log('Clicking Activity tab...');
  await activityTab.first().click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);
  const screen8Path = path.join(OUT_DIR, '08_bonk_activity.png');
  await page.screenshot({ path: screen8Path, fullPage: false });
  console.log('Saved:', screen8Path);

  // 4. Audit Evidence & Log
  const evidenceTab = page.locator('button:has-text("Audit Evidence")');
  console.log('Clicking Evidence tab...');
  await evidenceTab.first().click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);
  const screen9Path = path.join(OUT_DIR, '09_bonk_evidence.png');
  await page.screenshot({ path: screen9Path, fullPage: false });
  console.log('Saved:', screen9Path);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
