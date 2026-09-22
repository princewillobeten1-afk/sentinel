#!/usr/bin/env node
/**
 * CI bundle-size regression gate (Sprint 31 — Item 13), same lightweight
 * style as Sprint 30's `scripts/scan-secrets.mjs`.
 *
 * Parses `next build`'s own per-route "First Load JS" table (the same
 * output every prior sprint's manual verification already read by eye) —
 * not `.next`'s internal manifest files, which don't consistently enumerate
 * every route across Next.js versions and aren't a documented public
 * contract the way the build's printed summary is.
 *
 * Two independent checks, either one fails the build:
 *  1. Absolute ceiling — no page's First Load JS may exceed
 *     `ABSOLUTE_LIMIT_BYTES` (300KB, tunable).
 *  2. Regression vs. baseline — no page may grow more than
 *     `REGRESSION_THRESHOLD` (15%) over `scripts/bundle-size-baseline.json`.
 *     A page with no baseline entry (a new route) only gets the absolute
 *     check; run with `--update-baseline` to (re)generate the baseline file
 *     after an intentional size change.
 *
 * Usage:
 *   npm run build > build-output.txt 2>&1
 *   node scripts/check-bundle-size.mjs build-output.txt
 *   node scripts/check-bundle-size.mjs build-output.txt --update-baseline
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(__dirname, 'bundle-size-baseline.json');

const ABSOLUTE_LIMIT_BYTES = 300 * 1024;
const REGRESSION_THRESHOLD = 0.15;

const UNIT_MULTIPLIERS = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };

function parseSizeToBytes(sizeStr) {
  const match = sizeStr.trim().match(/^([\d.]+)\s*([A-Za-z]+)$/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multiplier = UNIT_MULTIPLIERS[unit];
  if (multiplier === undefined) return null;
  return Math.round(value * multiplier);
}

/**
 * Matches a route row from `next build`'s printed table, e.g.:
 *   "├ ○ /discover                                            1.84 kB         115 kB"
 *   "└ ƒ /wallet/[chain]/[address]                            2.21 kB        89.8 kB"
 * Tree-drawing prefix, a route symbol (○ static / ƒ dynamic / ● SSG), the
 * route path, then two size columns (own JS, First Load JS).
 */
const ANSI_ESCAPE_REGEX = /\u001B\[[0-?]*[ -/]*[@-~]/g;
// Match from the route path to the two size columns instead of depending on
// Next's decorative tree glyphs. GitHub runners have emitted both Unicode
// tree prefixes and plain/ANSI-prefixed rows across Next minor versions.
const ROUTE_LINE_REGEX = /(\/\S*)\s+([\d.]+\s*[A-Za-z]+)\s+([\d.]+\s*[A-Za-z]+)\s*$/;

export function parseBuildOutput(text) {
  const routes = [];
  for (const line of text.replace(ANSI_ESCAPE_REGEX, '').split('\n')) {
    const match = line.match(ROUTE_LINE_REGEX);
    if (!match) continue;
    const [, route, ownSize, firstLoad] = match;
    const firstLoadBytes = parseSizeToBytes(firstLoad);
    // API routes always print "0 B / 0 B" — not meaningful bundle-size data.
    if (firstLoadBytes === null || firstLoadBytes === 0) continue;
    routes.push({ route, ownSizeBytes: parseSizeToBytes(ownSize), firstLoadBytes });
  }
  return routes;
}

export function evaluateBundleSizes(routes, baseline) {
  const failures = [];
  const warnings = [];

  for (const { route, firstLoadBytes } of routes) {
    if (firstLoadBytes > ABSOLUTE_LIMIT_BYTES) {
      failures.push(
        `${route}: ${(firstLoadBytes / 1024).toFixed(1)}KB exceeds the ${ABSOLUTE_LIMIT_BYTES / 1024}KB absolute limit`,
      );
    }

    const baselineBytes = baseline[route];
    if (baselineBytes === undefined) {
      warnings.push(`${route}: no baseline entry — absolute-limit check only (run with --update-baseline to add it)`);
      continue;
    }

    const growth = (firstLoadBytes - baselineBytes) / baselineBytes;
    if (growth > REGRESSION_THRESHOLD) {
      failures.push(
        `${route}: ${(firstLoadBytes / 1024).toFixed(1)}KB is ${(growth * 100).toFixed(1)}% over its ${(baselineBytes / 1024).toFixed(1)}KB baseline (limit +${REGRESSION_THRESHOLD * 100}%)`,
      );
    }
  }

  return { failures, warnings };
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function main() {
  const args = process.argv.slice(2);
  const updateBaseline = args.includes('--update-baseline');
  const buildOutputPath = args.find((a) => !a.startsWith('--'));

  if (!buildOutputPath) {
    console.error('Usage: node scripts/check-bundle-size.mjs <build-output.txt> [--update-baseline]');
    process.exit(1);
  }

  const text = readFileSync(buildOutputPath, 'utf-8');
  const routes = parseBuildOutput(text);

  if (routes.length === 0) {
    console.error('check-bundle-size: found no route size rows in the build output — did the build actually succeed?');
    process.exit(1);
  }

  if (updateBaseline) {
    const baseline = Object.fromEntries(routes.map((r) => [r.route, r.firstLoadBytes]));
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`check-bundle-size: wrote baseline for ${routes.length} routes to ${path.relative(process.cwd(), BASELINE_PATH)}`);
    return;
  }

  const baseline = loadBaseline();
  const { failures, warnings } = evaluateBundleSizes(routes, baseline);

  for (const warning of warnings) {
    console.warn(`  ⚠ ${warning}`);
  }

  if (failures.length > 0) {
    console.error(`\n✗ check-bundle-size found ${failures.length} issue(s):\n`);
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exit(1);
  }

  console.log(`check-bundle-size: checked ${routes.length} routes, all within limits.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
