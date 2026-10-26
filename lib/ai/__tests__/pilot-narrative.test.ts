import { describe, expect, it } from 'vitest';
import { fact } from '../pilot/evidence';
import { validateNarrative, extractNumbers, templateAnswer } from '../pilot/narrative';

const mint = 'So11111111111111111111111111111111111111112';
const at = () => new Date().toISOString();
const liq = fact({ mint, metric: 'liquidityUsd', label: 'Liquidity', value: 1243000, unit: 'USD', category: 'market' }, { status: 'measured', source: 'x', observedAt: at() });
const top = fact({ mint, metric: 'top10', label: 'Top ten concentration', value: 38.62, unit: '%', category: 'ownership' }, { status: 'measured', source: 'x', observedAt: at() });
const rsi = fact({ mint, metric: 'rsi14', label: 'RSI (14)', value: 74.1, unit: 'index', category: 'chart' }, { status: 'measured', source: 'x', observedAt: at() });
const facts = [liq, top, rsi];

const good = {
  sections: [
    { title: 'Verdict', text: 'Mixed structure: liquidity is solid but supply is concentrated.', evidenceIds: [liq.id, top.id] },
    { title: 'Key findings', text: '• Liquidity of $1.24M can absorb moderate size.\n• Top-10 wallets hold 38.6% of supply.\n• RSI(14) at 74.1 is above the 70 overbought line.', evidenceIds: [liq.id, top.id, rsi.id] },
    { title: 'Risks', text: '• Concentrated holders could add sell pressure.', evidenceIds: [top.id] },
    { title: 'What to watch', text: '• Whether concentration falls over the next 24h.', evidenceIds: [] },
  ],
};

describe('narrative answers', () => {
  it('accepts grounded analyst prose with real numbers', () => {
    const r = validateNarrative(good, facts);
    expect(r.errors).toBeUndefined();
    expect(r.answer?.validated).toBe(true);
    expect(r.answer?.sections[0].title).toBe('Verdict');
  });

  it('rejects invented numbers', () => {
    const bad = { sections: [{ title: 'Verdict', text: 'Liquidity is $5M.', evidenceIds: [liq.id] }] };
    expect(validateNarrative(bad, facts).errors?.join()).toMatch(/numbers not found/);
  });

  it('rejects uncited verdicts and unknown ids', () => {
    expect(validateNarrative({ sections: [{ title: 'Verdict', text: 'Looks mixed.', evidenceIds: [] }] }, facts).errors).toBeDefined();
    expect(validateNarrative({ sections: [{ title: 'Verdict', text: 'Looks mixed.', evidenceIds: ['e_fake'] }] }, facts).errors).toBeDefined();
  });

  it.each(['This will pump soon.', 'You should buy here.', 'This token is safe.', 'Data from birdeye says so.', 'See https://x.y'])('rejects unsafe text: %s', text => {
    expect(validateNarrative({ sections: [{ title: 'Verdict', text, evidenceIds: [liq.id] }] }, facts).errors).toBeDefined();
  });

  it('allows general answers without evidence when no facts were gathered', () => {
    const r = validateNarrative({ sections: [{ title: 'Verdict', text: 'RSI(14) above 70 is commonly read as overbought.', evidenceIds: [] }] }, []);
    expect(r.answer).toBeDefined();
  });

  it('parses K/M/B and percent tokens but ignores timeframes', () => {
    const n = extractNumbers('$1.24M, 38.6%, 2.5K over 24h and 5m');
    expect(n.map(t => t.value)).toEqual([1240000, 38.6, 2500]);
  });

  it('builds a template fallback from evidence', () => {
    expect(templateAnswer(facts)?.sections.length).toBeGreaterThan(0);
    expect(templateAnswer([])).toBeNull();
  });
});
