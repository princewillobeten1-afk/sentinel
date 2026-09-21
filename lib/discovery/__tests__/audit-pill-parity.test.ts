import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Both token cards render the ownership audit from one component.
 *
 * They previously carried separate copies of the same thresholds, and the
 * copies had drifted: the Overview card had no Insiders pill, no pending
 * state, and hid the entire row unless one of three specific fields happened
 * to be present. The same token, off the same endpoint, could therefore read
 * as audited in Discover and unaudited in Overview.
 */
const root = process.cwd();
const DISCOVER_CARD = join(root, 'components', 'discovery', 'token-card.tsx');
const OVERVIEW_CARD = join(root, 'components', 'ui', 'token-card.tsx');
const PILLS = join(root, 'components', 'ui', 'audit-pills.tsx');

const read = (path: string) => readFileSync(path, 'utf8');

describe('audit pills are shared, not duplicated', () => {
  it('both cards render the shared component', () => {
    expect(read(DISCOVER_CARD)).toContain('<AuditPills');
    expect(read(OVERVIEW_CARD)).toContain('<AuditPills');
  });

  it('neither card hand-rolls a threshold comparison', () => {
    // The specific comparisons that used to live in both files.
    for (const path of [DISCOVER_CARD, OVERVIEW_CARD]) {
      const body = read(path)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(body, `${path} must not compare top-10 inline`).not.toMatch(
        /top10\w*\s*[><]=?\s*\d/,
      );
      expect(body, `${path} must not compare snipers inline`).not.toMatch(
        /sniper\w*\s*[><]=?\s*\d/i,
      );
      expect(body, `${path} must not compare bundlers inline`).not.toMatch(
        /bundler\w*\s*[><]=?\s*\d/i,
      );
    }
  });

  it('the shared component covers all five metrics in a fixed order', () => {
    const body = read(PILLS);
    const order = ['top10', 'dev', 'snipers', 'insiders', 'bundlers'];
    const positions = order.map((key) => body.indexOf(`key: '${key}'`));

    expect(positions.every((p) => p >= 0), 'every pill must be present').toBe(true);
    // The spec calls for them "always shown together, same order".
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('renders unknown as neutral, never as the safe colour', () => {
    const body = read(PILLS);
    // The bug this guards: a constant that fell inside its own safe band made
    // every unaudited token show green.
    expect(body).toMatch(/state\.kind !== 'value'\s*\?\s*NEUTRAL/);
    expect(body).toContain("const NEUTRAL");
  });
});
