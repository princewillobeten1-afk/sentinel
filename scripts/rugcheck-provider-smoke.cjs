// Read-only checks of the real report consumers. Never print keys, endpoint URLs,
// provider error bodies, or raw reports. No signing, transactions, or persistence.
require('@next/env').loadEnvConfig(process.cwd());
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'server-only') request = path.join(process.cwd(), 'lib/empty-mock.js');
  if (request.startsWith('@/')) request = path.join(process.cwd(), request.slice(2));
  return resolve.call(this, request, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

async function main() {
  const { rugcheckConfig, rugcheckReportUrl } = require('../lib/trading/rugcheck-config.ts');
  const { rugcheckAccessHealth } = require('../lib/trading/rugcheck-report.ts');
  const { fetchRugcheckOwnership } = require('../lib/trading/rugcheck-ownership.ts');
  const { getLiquidityLock } = require('../lib/trading/rugcheck-liquidity.ts');
  const mint = process.argv[2] || '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN';
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) throw new Error('Invalid mint.');
  const settings = rugcheckConfig();
  const observations = [];
  const nativeFetch = global.fetch;
  global.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    observations.push({ service: new URL(String(input)).hostname === 'shield.rugcheck.xyz' ? 'shield' : 'rugcheck', http: response.status });
    return response;
  };
  try {
    const [ownership, liquidity] = await Promise.all([fetchRugcheckOwnership(mint), getLiquidityLock(mint)]);
    // Independently prove the configured Shield URL can return this report.
    // Do not manufacture a primary outage or bypass a real provider quota.
    let shield = { configured: Boolean(settings.shield), tested: false };
    if (settings.shield && !observations.some(row => row.http === 429)) {
      await new Promise(resolve => setTimeout(resolve, 1_100));
      try {
        const response = await fetch(rugcheckReportUrl(settings.shield, mint), {
          headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(12_000),
        });
        const body = await response.json().catch(() => null);
        shield = { configured: true, tested: true, http: response.status, reportReceived: response.ok && body?.mint === mint };
      } catch { shield = { configured: true, tested: true, requestFailed: true }; }
    }
    console.log(JSON.stringify({ mint, observations, access: rugcheckAccessHealth(), shield,
      ownership: { received: Boolean(ownership), top10Pct: ownership?.top10Pct ?? null,
        devPct: ownership?.devPct ?? null, totalHolders: ownership?.totalHolders ?? null, source: ownership?.source ?? null },
      liquidity: { lpLockedPct: liquidity.lpLockedPct, status: liquidity.evidence.status, source: liquidity.evidence.source },
    }, null, 2));
  } finally { global.fetch = nativeFetch; }
}
main().catch(() => { console.error('Rugcheck report probe failed; check server-only configuration.'); process.exitCode = 1; });
