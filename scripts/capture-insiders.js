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

  console.log('Waiting for verdict card...');
  await page.waitForSelector('text=AI Sentinel Verdict', { timeout: 25000 });
  await page.waitForTimeout(1000);

  const insiderTab = page.locator('button:has-text("Insider & Snipers")');
  console.log('Clicking Insider tab...');
  await insiderTab.first().click();
  await page.waitForTimeout(1000);

  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);

  const screenPath = path.join(OUT_DIR, '05_bonk_insiders.png');
  await page.screenshot({ path: screenPath, fullPage: false });
  console.log('Saved:', screenPath);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
