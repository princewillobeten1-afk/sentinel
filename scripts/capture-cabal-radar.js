const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = 'C:\\Users\\HomePC\\.gemini\\antigravity-ide\\brain\\9ab7d1c6-f925-4b52-aa83-63eb932af7d4';

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  console.log('1. Navigating to Intelligence Command Center...');
  const candidatesPromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/intelligence/candidates') && resp.status() === 200,
    { timeout: 45000 }
  ).catch(() => null);

  await page.goto('http://localhost:3000/intelligence', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });

  await candidatesPromise;
  await page.waitForTimeout(3000);

  const screenScreener = path.join(OUT_DIR, '10_cabal_screener_matrix.png');
  await page.screenshot({ path: screenScreener, fullPage: false });
  console.log('Saved:', screenScreener);

  console.log('2. Navigating to BONK Intelligence Report...');
  const reportPromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/intelligence/solana/') && resp.status() === 200,
    { timeout: 45000 }
  ).catch(() => null);

  await page.goto('http://localhost:3000/intelligence/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });

  await reportPromise;
  await page.waitForTimeout(3000);

  console.log('3. Clicking Cabal Radar & Sentinel Tab...');
  await page.evaluate(() => window.scrollTo(0, 350));
  const cabalTab = page.locator('button[data-tab-id="cabal_radar"]');
  if (await cabalTab.count() > 0) {
    await cabalTab.click();
    await page.waitForTimeout(1500);
  }

  await page.evaluate(() => window.scrollBy(0, 450));
  await page.waitForTimeout(1000);

  const screenTab = path.join(OUT_DIR, '11_cabal_radar_sentinel_tab.png');
  await page.screenshot({ path: screenTab, fullPage: false });
  console.log('Saved:', screenTab);

  // Trigger Sentinel Simulation Test
  console.log('4. Testing Sentinel Simulation Test Button...');
  const simBtn = page.locator('button:has-text("Test Front-Run Eject Simulation")');
  if (await simBtn.count() > 0) {
    await simBtn.click();
    await page.waitForTimeout(3500);

    const screenSim = path.join(OUT_DIR, '12_cabal_sentinel_simulation_active.png');
    await page.screenshot({ path: screenSim, fullPage: false });
    console.log('Saved:', screenSim);
  }

  await browser.close();
  console.log('All Cabal Radar captures finished successfully!');
}

run().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
