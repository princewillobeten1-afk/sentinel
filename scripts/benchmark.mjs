#!/usr/bin/env node
/**
 * Ad-hoc local benchmark (Sprint 31 — Item 14), same lightweight
 * self-contained style as `scripts/scan-secrets.mjs` and
 * `scripts/check-bundle-size.mjs`.
 *
 * Hits a handful of hot endpoints against a running `node server.js` with
 * modest concurrency and reports latency percentiles + throughput. This is
 * NOT a load test — see docs/performance/out-of-scope.md for why real
 * load/stress/spike testing at any meaningful concurrency isn't attempted.
 * It exists to put real numbers (not guesses) into
 * docs/performance/benchmarks.md, from this one dev-mode process on one
 * machine.
 *
 * Usage: node server.js &  (or otherwise have it already running)
 *        node scripts/benchmark.mjs
 */

import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.BENCHMARK_BASE_URL || 'http://localhost:3000';
const REQUESTS_PER_ENDPOINT = 30;
const CONCURRENCY = 5;

const ENDPOINTS = [
  { name: 'discovery:trending', path: '/api/v1/discovery/trending?limit=20' },
  { name: 'discovery:liquidity', path: '/api/v1/discovery/liquidity?limit=20' },
  { name: 'discovery:new', path: '/api/v1/discovery/new?limit=20' },
  { name: 'chart:initial-load', path: '/api/v1/tokens/solana/SENT/chart?timeframe=15m&limit=100' },
  { name: 'chart:load-older', path: '/api/v1/tokens/solana/SENT/chart?timeframe=15m&limit=100&before=1786797000' },
  { name: 'market:live-summary', path: '/api/v1/market/live/summary' },
  { name: 'discovery:watchlist', path: '/api/v1/discovery/watchlist?limit=20', auth: true },
  { name: 'user:usage', path: '/api/v1/user/usage', auth: true },
];

/** Nearest-rank percentiles — mirrors `lib/server/usage-log.ts#computePercentiles`. */
function computePercentiles(latenciesMs) {
  if (latenciesMs.length === 0) return { p50: 0, p95: 0, p99: 0, sampleSize: 0 };
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const nearestRank = (percentile) => {
    const rank = Math.ceil((percentile / 100) * sorted.length);
    const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
    return sorted[index];
  };
  return { p50: nearestRank(50), p95: nearestRank(95), p99: nearestRank(99), sampleSize: sorted.length };
}

async function timedFetch(url, headers) {
  const start = performance.now();
  let status = 0;
  try {
    const res = await fetch(url, { headers });
    status = res.status;
    await res.arrayBuffer(); // drain the body so timing covers the full transfer
  } catch {
    status = 0;
  }
  return { latencyMs: performance.now() - start, status };
}

async function benchmarkEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const headers = endpoint.auth ? { Authorization: 'Bearer demo-token' } : {};
  const results = [];

  const wallStart = performance.now();
  let index = 0;
  async function worker() {
    while (index < REQUESTS_PER_ENDPOINT) {
      index += 1;
      results.push(await timedFetch(url, headers));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const wallElapsedMs = performance.now() - wallStart;

  const percentiles = computePercentiles(results.map((r) => r.latencyMs));
  const errorCount = results.filter((r) => r.status === 0 || r.status >= 500).length;
  const reqPerSec = (results.length / wallElapsedMs) * 1000;

  return { name: endpoint.name, path: endpoint.path, percentiles, reqPerSec, errorCount, sampleSize: results.length };
}

async function main() {
  console.log(`Benchmarking ${BASE_URL} — ${REQUESTS_PER_ENDPOINT} requests/endpoint, concurrency ${CONCURRENCY}\n`);

  const rows = [];
  for (const endpoint of ENDPOINTS) {
    process.stdout.write(`  ${endpoint.name}... `);
    const result = await benchmarkEndpoint(endpoint);
    rows.push(result);
    console.log(
      `p50=${result.percentiles.p50.toFixed(0)}ms p95=${result.percentiles.p95.toFixed(0)}ms ` +
      `p99=${result.percentiles.p99.toFixed(0)}ms req/s=${result.reqPerSec.toFixed(1)} errors=${result.errorCount}/${result.sampleSize}`,
    );
  }

  console.log('\n| Endpoint | p50 | p95 | p99 | req/s | errors |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(
      `| \`${r.path}\` | ${r.percentiles.p50.toFixed(0)}ms | ${r.percentiles.p95.toFixed(0)}ms | ` +
      `${r.percentiles.p99.toFixed(0)}ms | ${r.reqPerSec.toFixed(1)} | ${r.errorCount}/${r.sampleSize} |`,
    );
  }
}

main();
