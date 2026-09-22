// Read-only audit probe: no persistence, subscriptions, wallet signing or transactions.
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

async function read(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(12_000) });
    return { status: res.status, body: res.ok ? await res.json() : null };
  } catch (error) { return { status: null, error: error.name, body: null }; }
}
async function main() {
  const { fetchHolderProfileResult } = require('../lib/market/enrichment/holder-profile.ts');
  const { composeTokenAudit } = require('../lib/trading/audit-model.ts');
  const { parseLiquidityLock } = require('../lib/trading/rugcheck-liquidity.ts');
  const { PublicKey } = require('@solana/web3.js');
  const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, unpackMint } = require('@solana/spl-token');
  const recent = await read('https://lite-api.jup.ag/tokens/v2/recent');
  const candidate = Array.isArray(recent.body) ? recent.body.find(token => token.dev) : null;
  const mint = candidate?.id || 'So11111111111111111111111111111111111111112';
  const jupiter = await read(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`);
  const exact = Array.isArray(jupiter.body) ? jupiter.body.find(token => token.id === mint) : null;
  const holder = await fetchHolderProfileResult(mint);
  const rpc = process.env.HELIUS_RPC_URL?.trim() || (process.env.HELIUS_API_KEY?.trim()
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY.trim()}` : null);
  const authority = rpc ? await read(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [mint, { encoding: 'base64', commitment: 'confirmed' }] }) }) : { status: null, body: null };
  const info = authority.body?.result?.value;
  let mintRevoked, freezeRevoked;
  if (info && [TOKEN_PROGRAM_ID.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58()].includes(info.owner)) {
    const decoded = unpackMint(new PublicKey(mint), { ...info, owner: new PublicKey(info.owner), data: Buffer.from(info.data[0], 'base64') }, new PublicKey(info.owner));
    if (decoded.isInitialized) { mintRevoked = decoded.mintAuthority === null; freezeRevoked = decoded.freezeAuthority === null; }
  }
  const liquidity = await read(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`);
  const lpLockedPct = parseLiquidityLock(liquidity.body);
  const observedAt = new Date().toISOString();
  const evidence = (source, known) => ({ source, status: known ? 'measured' : 'unavailable', observedAt, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const data = composeTokenAudit(mint, { isMintRenounced: mintRevoked, isFreezeDisabled: freezeRevoked,
    securityEvidence: evidence('helius-rpc', mintRevoked !== undefined && freezeRevoked !== undefined),
    isLiquidityLocked: lpLockedPct === null ? undefined : lpLockedPct >= 99.9,
    liquidityEvidence: evidence('rugcheck-largest-pool-lock', lpLockedPct !== null),
  }, holder.kind === 'ok' ? holder.profile : null, exact || null, evidence('jupiter-tokens', !!exact), false);
  const report = { checkedAt: observedAt, mint, providers: {
    jupiter: { http: jupiter.status, exactMint: !!exact }, birdeye: { result: holder.kind, http: holder.status },
    helius: { http: authority.status, mintDecoded: mintRevoked !== undefined }, rugcheck: { http: liquidity.status, lpLockedPct },
  }, audit: { top10: data.top10HoldersPct, dev: data.devBalancePct, snipers: data.snipersPct, insiders: data.insidersPct,
    bundlers: data.bundlersPct, holders: data.totalHolders, mintRevoked: data.mintAuthorityDisabled, freezeRevoked: data.freezeAuthorityDisabled,
    ownership: data.ownershipEvidence.status, lpBurn: data.lpTokensBurned, honeypotTax: data.honeypotTaxZero } };
  const output = path.join(process.cwd(), 'artifacts', 'audit-freshness');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'provider-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ error: error.name })); process.exitCode = 1; });
