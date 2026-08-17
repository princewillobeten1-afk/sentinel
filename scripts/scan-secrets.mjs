#!/usr/bin/env node
/**
 * Lightweight secret scanner (Sprint 30 — Tier 7).
 *
 * No budget for a paid tool (e.g. Gitleaks-as-a-service) — this greps every
 * `git ls-files`-tracked file (so it only ever scans what's actually
 * tracked, not `.gitignore`d local files like `.env`) for a short list of
 * high-confidence secret patterns. Not a substitute for a real
 * secret-scanning product, but catches the obvious, high-severity cases
 * (a live API key literal, a committed `.env`, a private key file) with
 * zero new dependencies.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  { name: 'Sentinel live API key', regex: /sk_live_[A-Za-z0-9_-]{16,}/g },
  { name: 'PEM private key block', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'AWS access key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Generic long hex/base64 secret assignment', regex: /(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-/+]{32,}['"]/gi },
];

// A committed `.env` (as opposed to `.env.local.example`, which is a safe
// tracked template) is a finding on its own, regardless of content.
const FORBIDDEN_FILENAMES = [/(^|\/)\.env$/, /(^|\/)\.env\.local$/, /(^|\/)\.env\.production$/];

function listTrackedFiles() {
  try {
    const output = execFileSync('git', ['ls-files'], { encoding: 'utf-8', cwd: process.cwd() });
    return output.split('\n').filter(Boolean);
  } catch (err) {
    console.error('scan-secrets: not a git repository (or git is unavailable) — nothing to scan against `git ls-files`.');
    return [];
  }
}

function isLikelyBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

function main() {
  const files = listTrackedFiles();
  const findings = [];

  for (const file of files) {
    for (const pattern of FORBIDDEN_FILENAMES) {
      if (pattern.test(file)) {
        findings.push({ file, pattern: 'Committed .env-style file', match: file });
      }
    }

    let content;
    try {
      const buffer = readFileSync(file);
      if (isLikelyBinary(buffer)) continue;
      content = buffer.toString('utf-8');
    } catch {
      continue; // deleted/unreadable in the working tree (e.g. a rename in progress) — not this script's concern
    }

    for (const { name, regex } of PATTERNS) {
      const matches = content.match(regex);
      if (matches) {
        for (const match of matches) {
          findings.push({ file, pattern: name, match: match.slice(0, 12) + '…' });
        }
      }
    }
  }

  if (findings.length > 0) {
    console.error(`\n✗ scan-secrets found ${findings.length} potential secret(s):\n`);
    for (const f of findings) {
      console.error(`  ${f.file} — ${f.pattern} (${f.match})`);
    }
    console.error('\nIf any of these are real secrets, rotate them and remove them from tracked files.');
    process.exit(1);
  }

  console.log(`scan-secrets: checked ${files.length} tracked files, no findings.`);
}

main();
