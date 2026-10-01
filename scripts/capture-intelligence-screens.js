const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:\\Users\\HomePC\\.gemini\\antigravity-ide\\brain\\9ab7d1c6-f925-4b52-aa83-63eb932af7d4';

async function run() {
  console.log('Launching browser via system Chrome...');
  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
    });
  } catch (err) {
    console.log('Chrome channel failed, falling back to msedge...', err.message);
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  // 1. Intelligence Command Center
  console.log('Navigating to Intelligence Command Center...');
  const candidatesResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/intelligence/candidates') && resp.status() === 200,
    { timeout: 45000 }
  ).catch(() => null);

  await page.goto('http://localhost:3000/intelligence', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await candidatesResponsePromise;
  await page.waitForTimeout(2000);

  const screen1Path = path.join(OUT_DIR, '01_intelligence_command_center.png');
  await page.screenshot({ path: screen1Path, fullPage: false });
  console.log('Saved:', screen1Path);

  // 2. Token Deep Dive - BONK
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

  const screen2Path = path.join(OUT_DIR, '02_bonk_executive_verdict.png');
  await page.screenshot({ path: screen2Path, fullPage: false });
  console.log('Saved:', screen2Path);

  // 3. Tab: Bubble Map & Clusters
  try {
    const bubbleTab = page.locator('button:has-text("Bubble Map")');
    if (await bubbleTab.count() > 0) {
      console.log('Clicking Bubble Map tab...');
      await bubbleTab.first().click();
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      const screen3Path = path.join(OUT_DIR, '03_bonk_bubble_map.png');
      await page.screenshot({ path: screen3Path, fullPage: false });
      console.log('Saved:', screen3Path);
    }
  } catch (e) {
    console.warn('Bubble tab capture failed:', e.message);
  }

  // 4. Tab: Exitability & Slippage Simulator
  try {
    const exitTab = page.locator('button:has-text("Exitability")');
    if (await exitTab.count() > 0) {
      console.log('Clicking Exitability tab...');
      await exitTab.first().click();
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      const screen4Path = path.join(OUT_DIR, '04_bonk_exit_simulator.png');
      await page.screenshot({ path: screen4Path, fullPage: false });
      console.log('Saved:', screen4Path);
    }
  } catch (e) {
    console.warn('Exit simulator tab capture failed:', e.message);
  }

  // 5. Tab: Insider & Snipers
  try {
    const insiderTab = page.locator('button:has-text("Insider & Snipers")');
    if (await insiderTab.count() > 0) {
      console.log('Clicking Insider tab...');
      await insiderTab.first().click();
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      const screen5Path = path.join(OUT_DIR, '05_bonk_insiders.png');
      await page.screenshot({ path: screen5Path, fullPage: false });
      console.log('Saved:', screen5Path);
    }
  } catch (e) {
    console.warn('Insiders tab capture failed:', e.message);
  }

  // 6. Tab: Supply & Ownership
  try {
    const supplyTab = page.locator('button:has-text("Supply & Ownership")');
    if (await supplyTab.count() > 0) {
      console.log('Clicking Supply tab...');
      await supplyTab.first().click();
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      const screen6Path = path.join(OUT_DIR, '06_bonk_supply_ownership.png');
      await page.screenshot({ path: screen6Path, fullPage: false });
      console.log('Saved:', screen6Path);
    }
  } catch (e) {
    console.warn('Supply tab capture failed:', e.message);
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
