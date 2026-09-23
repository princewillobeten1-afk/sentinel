// Read-only lifecycle smoke test. No wallet signing, swaps, or transaction submission.
require('@next/env').loadEnvConfig(process.cwd());
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'server-only') request = path.join(process.cwd(), 'lib/empty-mock.js');
  if (request.startsWith('@/')) request = path.join(process.cwd(), request.slice(2));
  return originalResolve.call(this, request, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  fileName: filename,
}).outputText, filename);

async function main() {
  const { fetchJupiterFeed, hasReadableCurve, hasGraduated } = require('../lib/discovery/jupiter-feed.ts');
  const { fetchBondingCurves } = require('../lib/market/lifecycle/bonding-curve.ts');
  const { applyCurveReading, recordMigration } = require('../lib/market/lifecycle/lifecycle-engine.ts');
  const { MigrationHistory } = require('../lib/market/lifecycle/migration-history.ts');
  const { getLiveDiscoveryTokens } = require('../lib/discovery/live-solana-feed.ts');
  const rpc = process.env.LIFECYCLE_RPC_URL?.trim() || process.env.HELIUS_RPC_URL?.trim()
    || (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY.trim()}` : 'https://api.mainnet-beta.solana.com');
  const feeds = await Promise.allSettled([
    fetchJupiterFeed('toptrending', { limit: 100, window: '5m' }),
    fetchJupiterFeed('toptrending', { limit: 100, window: '1h' }),
    fetchJupiterFeed('toptrending', { limit: 100, window: '6h' }),
    fetchJupiterFeed('toptraded', { limit: 100, window: '5m' }),
    fetchJupiterFeed('toptraded', { limit: 100, window: '1h' }),
    fetchJupiterFeed('toptraded', { limit: 100, window: '6h' }),
    fetchJupiterFeed('toporganicscore', { limit: 100, window: '5m' }),
    fetchJupiterFeed('toporganicscore', { limit: 100, window: '1h' }),
    fetchJupiterFeed('recent', { limit: 100 }),
  ]);
  const jupCandidates = feeds.flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .filter(token => (hasReadableCurve(token) || (token.id && token.id.endsWith('pump'))) && !hasGraduated(token))
    .map(token => token.id);

  let dexCandidates = [];
  try {
    const dexUrls = [
      'https://api.dexscreener.com/token-boosts/top/v1',
      'https://api.dexscreener.com/token-boosts/latest/v1',
      'https://api.dexscreener.com/token-profiles/latest/v1',
    ];
    const dexResults = await Promise.allSettled(
      dexUrls.map((url) =>
        fetch(url, { headers: { accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ),
    );
    dexCandidates = dexResults.flatMap(r => r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [])
      .filter(item => item?.chainId === 'solana' && item?.tokenAddress && (item.tokenAddress.endsWith('pump') || (typeof item.url === 'string' && item.url.includes('pump'))))
      .map(item => item.tokenAddress);
  } catch {}

  const candidates = [...new Set([...jupCandidates, ...dexCandidates])].slice(0, 100);
  const curves = await fetchBondingCurves(rpc, candidates);
  for (const [mint, curve] of curves) applyCurveReading(mint, curve);
  let migrations = 0;
  await new MigrationHistory().reconcile(rpc, result => {
    migrations++;
    recordMigration(result.mint, { signature: result.signature, poolAddress: result.poolAddress, dex: result.dex, migratedAt: result.migratedAt });
  });
  const finalStretch = await getLiveDiscoveryTokens({ section: 'migrating' });
  const migrated = await getLiveDiscoveryTokens({ section: 'graduated' });
  const report = {
    checkedAt: new Date().toISOString(), feeds: feeds.map(result => result.status === 'fulfilled' ? { count: result.value.length } : { error: result.reason?.name || 'Error' }),
    curveCandidates: candidates.length, curvesRead: curves.size, migrationsConfirmed: migrations,
    finalStretch: finalStretch.map(token => ({ mint: token.mint, progress: token.bondingCurveProgress, observedAt: token.lifecycleEvidence?.observedAt })),
    migrated: migrated.map(token => ({ mint: token.mint, migratedAt: token.migratedAt, signature: token.migrationSignature, pool: token.migratedPool })),
  };
  fs.mkdirSync(path.join(process.cwd(), 'artifacts/discover-lifecycle'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'artifacts/discover-lifecycle/live-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ failed: true, error: error.name })); process.exitCode = 1; });
