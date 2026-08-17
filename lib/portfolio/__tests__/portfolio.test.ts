import { describe, it, expect } from 'vitest';
import { processPortfolioPipeline, sortPositions } from '../pipeline';
import { buildChainBreakdown } from '../portfolio-engine';
import { interpretPortfolioRisk } from '../portfolio-risk';
import { getWindow } from '../performance-engine';
import { buildAiPortfolioView, buildPortfolioNarrative } from '../ai-interface';
import {
  buildExposureSnapshot,
  buildPerformanceMetricRows,
  buildPnlSnapshot,
  buildPortfolioSnapshot,
  buildRiskSnapshot,
  toValuePoint,
} from '../snapshots';
import { createWalletGroup, isWalletAuthorized } from '../wallet-groups';
import { hasValue } from '../utils';
import {
  MOCK_COLD_WALLET,
  MOCK_EXTERNAL_WALLET,
  MOCK_MAIN_WALLET,
  MOCK_PORTFOLIO_TOKENS,
  MOCK_WALLET_GROUP,
  getMockPortfolioContext,
  getSingleWalletContext,
} from '@/lib/mocks/portfolio-mocks';

const result = processPortfolioPipeline({ context: getMockPortfolioContext() });

describe('Sprint 9 — Portfolio aggregation (spec §3, §13, §20)', () => {
  it('Produces mark, estimated exit and stress exit as three distinct totals', () => {
    const { overview } = result;
    const mark = overview.totalValue.usd as number;
    const exit = overview.estimatedExitValue.usd as number;
    const stress = overview.stressExitValue.usd as number;

    expect(mark).toBeGreaterThan(0);
    expect(exit).toBeLessThan(mark);
    expect(stress).toBeLessThan(exit);
  });

  it('Separates available balance from invested capital', () => {
    const { overview } = result;
    // Native assets and stables are deployable; token positions are not.
    expect(overview.availableBalance.usd).toBeGreaterThan(0);
    expect(overview.investedCapital.usd).toBeGreaterThan(0);
    expect(overview.availableBalance.usd).not.toBe(overview.totalValue.usd);
  });

  it('Reports today’s change against the last snapshot before midnight', () => {
    const { overview } = result;
    expect(hasValue(overview.todayChange)).toBe(true);
    expect(overview.todayChangePct).not.toBeNull();
  });

  it('Counts open positions, high-risk positions and pending transactions', () => {
    const { overview } = result;
    expect(overview.openPositionCount).toBeGreaterThan(0);
    expect(overview.highRiskPositionCount).toBeGreaterThanOrEqual(1);
    expect(overview.pendingCount).toBe(1);
  });

  it('Surfaces largest exposure, lowest exitability and highest risk', () => {
    const { exposureSummary } = result.overview;
    expect(exposureSummary.largestToken?.symbol).toBe('ALPHA');
    expect(exposureSummary.highestRisk?.symbol).toBe('ALPHA');
    expect(exposureSummary.lowestExitability?.symbol).toBeDefined();
  });
});

describe('Sprint 9 — Multi-wallet and multi-chain (spec §38, §39, §40, §41)', () => {
  it('Aggregates positions held across several grouped wallets', () => {
    const bonk = result.positions.find((position) => position.symbol === 'BONK');
    expect(bonk?.wallets.length).toBe(2);
  });

  it('Preserves each chain’s native asset, balances and fees', () => {
    const breakdown = buildChainBreakdown(result.positions, MOCK_PORTFOLIO_TOKENS);
    const chains = breakdown.map((entry) => entry.chain).sort();
    expect(chains).toEqual(['base', 'ethereum', 'solana']);

    const solana = breakdown.find((entry) => entry.chain === 'solana');
    const ethereum = breakdown.find((entry) => entry.chain === 'ethereum');
    const base = breakdown.find((entry) => entry.chain === 'base');

    expect(solana?.nativeBalance?.symbol).toBe('SOL');
    expect(ethereum?.nativeBalance?.symbol).toBe('ETH');
    expect(base?.nativeBalance?.symbol).toBe('ETH');
    expect(base?.nativeBalance?.quantity).toBe(2);
    // Solana holds the unpriced GHOST position, so its chain status is partial.
    expect(solana?.status).toBe('PARTIAL');
    expect(ethereum?.status).toBe('OK');
  });

  it('Does not merge wallets the user has not grouped (spec §39)', () => {
    const single = processPortfolioPipeline({ context: getSingleWalletContext() });
    const bonk = single.positions.find((position) => position.symbol === 'BONK');

    // With only the main wallet grouped, the BONK move out is an external
    // transfer: quantity leaves and no realized P&L is invented.
    expect(bonk?.quantity).toBe(500_000_000);
    expect(bonk?.realizedEntries).toHaveLength(0);
    expect(bonk?.limitations.join(' ')).toContain('without observable proceeds');
  });

  it('Authorizes portfolio reads only for wallets the user owns or grouped', () => {
    const userWallets = [{ address: MOCK_MAIN_WALLET }];
    expect(isWalletAuthorized(MOCK_MAIN_WALLET, userWallets, [MOCK_WALLET_GROUP], 'user_001')).toBe(true);
    expect(isWalletAuthorized(MOCK_COLD_WALLET, userWallets, [MOCK_WALLET_GROUP], 'user_001')).toBe(true);
    expect(isWalletAuthorized(MOCK_EXTERNAL_WALLET, userWallets, [MOCK_WALLET_GROUP], 'user_001')).toBe(false);
    // A group belonging to another user grants nothing.
    expect(isWalletAuthorized(MOCK_COLD_WALLET, userWallets, [MOCK_WALLET_GROUP], 'user_999')).toBe(false);
  });

  it('Wallet groups are private by default (spec §53)', () => {
    const group = createWalletGroup({
      id: 'wg_1',
      userId: 'user_001',
      name: 'Test Group',
      wallets: [{ address: MOCK_MAIN_WALLET, chain: 'solana', role: 'MAIN' }],
      createdAt: new Date().toISOString(),
    });
    expect(group.visibility).toBe('PRIVATE');
    expect(group.wallets[0].linkedBy).toBe('USER');
  });
});

describe('Sprint 9 — Exposure & concentration (spec §17, §18, §19)', () => {
  it('Breaks exposure down by token, chain, risk class and creator', () => {
    const { exposure } = result;
    expect(exposure.byToken.length).toBeGreaterThan(3);
    expect(exposure.byChain.map((bucket) => bucket.key).sort()).toEqual(['base', 'ethereum', 'solana']);
    expect(exposure.byRiskClass.length).toBeGreaterThan(0);
    expect(exposure.byCreator.length).toBeGreaterThan(0);

    // Shares are computed against measured value, so they sum to ~1.
    const tokenTotal = exposure.byToken.reduce((total, bucket) => total + bucket.sharePct, 0);
    expect(tokenTotal).toBeCloseTo(1, 3);
  });

  it('Reports largest, top 3 and top 5 concentration', () => {
    const { concentration } = result.exposure;
    expect(concentration.largestPositionPct).toBeGreaterThan(0);
    expect(concentration.top3Pct as number).toBeGreaterThan(concentration.largestPositionPct as number);
    expect(concentration.top5Pct as number).toBeGreaterThanOrEqual(concentration.top3Pct as number);
    expect(concentration.herfindahl).toBeGreaterThan(0);
    expect(concentration.effectivePositions).toBeGreaterThan(1);
  });

  it('Makes an observation about concentration without prescribing a trade', () => {
    const text = result.exposure.concentration.observations.join(' ').toLowerCase();
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('sell');
    expect(text).not.toContain('buy');
    expect(text).not.toContain('you should');
  });

  it('Computes liquidity-adjusted exposure per position', () => {
    const alpha = result.exposure.liquidityAdjusted.find((entry) => entry.tokenId === 'dt_alpha');
    const sent = result.exposure.liquidityAdjusted.find((entry) => entry.tokenId === 'dt_sentinel');

    // $35K position against ~$45K of usable liquidity.
    expect(alpha?.liquidityRatio).toBeGreaterThan(0.5);
    expect(alpha?.band).toBe('SEVERE');
    // Same notional order of magnitude, but against millions of liquidity.
    expect(sent?.liquidityRatio).toBeLessThan(0.01);
    expect(sent?.band).toBe('LOW');
  });

  it('Excludes unvalued positions from percentages and says so', () => {
    const { concentration, limitations } = result.exposure;
    expect(concentration.unmeasuredPositionIds.length).toBe(1);
    expect(limitations.join(' ')).toContain('excluded from every exposure percentage');
  });
});

describe('Sprint 9 — Portfolio risk (spec §15, §16)', () => {
  it('Is not the plain average of position risk scores', () => {
    const open = result.positions.filter((position) => position.status !== 'CLOSED');
    const plainAverage =
      open.reduce((total, position) => total + position.risk.score, 0) / open.length;
    expect(result.risk.score).not.toBeCloseTo(plainAverage, 1);
  });

  it('Decomposes into weighted position risk plus explicit penalties', () => {
    const { risk } = result;
    expect(risk.weightedPositionRisk).toBeGreaterThan(0);
    expect(risk.concentrationPenalty).toBeGreaterThanOrEqual(0);
    expect(risk.liquidityPenalty).toBeGreaterThan(0);
    expect(risk.correlationPenalty).toBeGreaterThan(0);
    expect(risk.score).toBeCloseTo(
      risk.weightedPositionRisk + risk.concentrationPenalty + risk.liquidityPenalty + risk.correlationPenalty,
      0,
    );
  });

  it('Names its primary drivers with evidence', () => {
    const interpretation = interpretPortfolioRisk(result.risk);
    expect(interpretation.headline).toMatch(/Portfolio Risk: \d+ \/ 100/);
    expect(interpretation.drivers.length).toBeGreaterThan(0);
    expect(result.risk.drivers.every((driver) => driver.evidence.length > 0)).toBe(true);
  });

  it('Position risk redistributes weight away from missing signals', () => {
    const sent = result.positions.find((position) => position.symbol === 'SENT');
    const newx = result.positions.find((position) => position.symbol === 'NEWX');

    expect(sent?.risk.confidence).toBe(1);
    // NEWX has no creator or insider coverage, so confidence is lower.
    expect(newx?.risk.confidence).toBeLessThan(1);
    expect(newx?.risk.components.some((component) => component.status === 'UNKNOWN')).toBe(true);
    // Weights of the present components still sum to 1.
    const weightSum = (newx?.risk.components ?? []).reduce((total, c) => total + c.weight, 0);
    expect(weightSum).toBeCloseTo(1, 3);
  });
});

describe('Sprint 9 — Performance & drawdown (spec §21, §25, §26, §35, §37)', () => {
  it('Provides Today, 7D, 30D and All-time windows', () => {
    expect(result.performance.windows.map((window) => window.window)).toEqual([
      'TODAY',
      '7D',
      '30D',
      'ALL',
    ]);
  });

  it('Every performance metric carries its sample size', () => {
    const all = getWindow(result.performance, 'ALL');
    expect(all?.trading.winRate.sample.count).toBe(all?.trading.totalTrades);
    expect(all?.trading.winRate.sample.adequacy).toBe('INSUFFICIENT');
    expect(all?.trading.winRate.sample.note).toContain('below the 20 needed');
  });

  it('Suppresses statistically meaningless metrics rather than showing them', () => {
    const all = getWindow(result.performance, 'ALL');
    // 2 closed trades cannot support a Sharpe-like ratio.
    expect(all?.trading.sharpeLike.value).toBeNull();
    expect(all?.trading.sortinoLike.value).toBeNull();
    expect(all?.trading.profitFactor.value).toBeNull();
    expect(all?.trading.sharpeLike.sample.note).toContain('Suppressed');
  });

  it('Computes peak, current value, maximum and current drawdown', () => {
    const all = getWindow(result.performance, 'ALL');
    const drawdown = all?.drawdown;
    expect(drawdown?.peakValueUsd).toBe(154_200);
    expect(drawdown?.currentValueUsd).toBe(129_600);
    expect(drawdown?.maxDrawdownPct).toBeCloseTo(0.1595, 3);
    expect(drawdown?.currentDrawdownPct).toBeCloseTo(0.1595, 3);
  });

  it('Segments holding periods into scalp / intraday / swing / long-term', () => {
    const all = getWindow(result.performance, 'ALL');
    const buckets = all?.holding.buckets.map((bucket) => bucket.bucket);
    expect(buckets).toEqual(['SCALP', 'INTRADAY', 'SWING', 'LONG_TERM']);
    expect(all?.holding.averageHours.value).toBeGreaterThan(0);
  });

  it('Attributes gains and losses per token without claiming causality', () => {
    const { attribution } = result.performance;
    expect(attribution.gains[0].label).toBe('SENT');
    expect(attribution.losses[0].label).toBe('QUANT');
    expect(attribution.costCentres.map((entry) => entry.key)).toContain('FEES');
    expect(attribution.costCentres.map((entry) => entry.key)).toContain('SLIPPAGE');
    expect(attribution.limitations.join(' ')).toContain('does not establish');
  });

  it('Attributes performance by strategy tag', () => {
    const strategies = result.performance.attribution.byStrategy.map((entry) => entry.key);
    expect(strategies).toContain('MARKET_ORDER');
    expect(strategies).toContain('STOP_LOSS');
  });
});

describe('Sprint 9 — Position timeline & intelligence (spec §28, §29)', () => {
  it('Builds a timeline combining blockchain events and Sentinel observations', () => {
    const sent = result.positions.find((position) => position.symbol === 'SENT');
    const types = sent?.timeline.map((event) => event.type) ?? [];

    expect(types).toContain('OPENED');
    expect(types).toContain('ADDED');
    expect(types).toContain('PARTIAL_EXIT');
    expect(sent?.timeline.every((event) => ['BLOCKCHAIN', 'SENTINEL'].includes(event.origin))).toBe(true);
  });

  it('Records internal transfers on the timeline without P&L', () => {
    const bonk = result.positions.find((position) => position.symbol === 'BONK');
    const transfer = bonk?.timeline.find((event) => event.type === 'TRANSFER_OUT');
    expect(transfer?.detail).toContain('No P&L recognised');
  });

  it('Carries the central position card fields', () => {
    const alpha = result.positions.find((position) => position.symbol === 'ALPHA');
    expect(alpha?.valuation.markValue.usd).toBeGreaterThan(0);
    expect(alpha?.allocationPct).toBeGreaterThan(0);
    expect(alpha?.risk.score).toBeGreaterThan(0);
    expect(alpha?.exitability?.score).toBeGreaterThan(0);
    expect(alpha?.exitability?.usableLiquidityUsd).toBeGreaterThan(0);
    expect(alpha?.liquidityAdjusted?.liquidityRatio).toBeGreaterThan(0);
  });

  it('Sorts positions by every supported column', () => {
    const byValue = sortPositions(result.positions, 'VALUE');
    const byRisk = sortPositions(result.positions, 'RISK');
    expect(byValue[0].symbol).toBe('ALPHA');
    expect(byRisk[0].symbol).toBe('ALPHA');
    expect(sortPositions(result.positions, 'ALLOCATION')[0].symbol).toBe('ALPHA');
  });
});

describe('Sprint 9 — Alerts & change detection (spec §30, §31, §32)', () => {
  it('Detects position changes against the previous portfolio state', () => {
    const types = result.changes.map((change) => change.type);
    expect(types).toContain('RISK_INCREASED');
    expect(result.changes.every((change) => change.evidence !== undefined)).toBe(true);
  });

  it('Emits portfolio alert events that are observations, not instructions', () => {
    expect(result.alertEvents.length).toBeGreaterThan(0);
    expect(result.alertEvents.every((event) => event.isAdvisory === false)).toBe(true);
    const text = result.alertEvents.map((event) => event.title).join(' ').toLowerCase();
    expect(text).not.toContain('you should');
    expect(text).not.toMatch(/\bsell now\b/);
  });

  it('Raises a concentration warning when one token dominates', () => {
    expect(result.alertEvents.some((event) => event.type === 'CONCENTRATION_WARNING')).toBe(true);
  });

  it('Evaluates a user-configured smart alert rule', () => {
    const ruled = processPortfolioPipeline({
      context: getMockPortfolioContext(),
      rules: [
        {
          id: 'rule_1',
          userId: 'user_001',
          portfolioId: 'pf_sentinel_primary',
          metric: 'POSITION_EXITABILITY',
          operator: 'LT',
          threshold: 90,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'rule_2',
          userId: 'user_001',
          portfolioId: 'pf_sentinel_primary',
          metric: 'POSITION_RISK',
          operator: 'GTE',
          threshold: 60,
          minAllocationPct: 20,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const ruleEvents = ruled.alertEvents.filter((event) => event.metadata.ruleId !== undefined);
    expect(ruleEvents.length).toBeGreaterThan(0);
    expect(ruleEvents.some((event) => event.metadata.ruleId === 'rule_2')).toBe(true);
  });

  it('Disabled rules never fire', () => {
    const ruled = processPortfolioPipeline({
      context: getMockPortfolioContext(),
      rules: [
        {
          id: 'rule_off',
          userId: 'user_001',
          portfolioId: 'pf_sentinel_primary',
          metric: 'PORTFOLIO_RISK',
          operator: 'GT',
          threshold: 1,
          enabled: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(ruled.alertEvents.some((event) => event.metadata.ruleId === 'rule_off')).toBe(false);
  });
});

describe('Sprint 9 — Snapshots & AI interface (spec §34, §47, §62)', () => {
  it('Builds portfolio, P&L, risk and exposure snapshots', () => {
    const portfolio = buildPortfolioSnapshot(result.overview, result.positions);
    const pnl = buildPnlSnapshot(result.overview);
    const risk = buildRiskSnapshot(result.risk);
    const exposure = buildExposureSnapshot(result.exposure);

    expect(portfolio.markValueUsd).toBeGreaterThan(0);
    expect(portfolio.estimatedExitValueUsd).toBeLessThan(portfolio.markValueUsd as number);
    expect(pnl.netUsd).not.toBeNull();
    expect(risk.score).toBe(result.risk.score);
    expect(exposure.byChain.length).toBe(3);
  });

  it('Flattens performance into metric rows that always carry sample size', () => {
    const rows = buildPerformanceMetricRows(result.performance);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => typeof row.sampleCount === 'number')).toBe(true);
    expect(rows.every((row) => row.sampleAdequacy.length > 0)).toBe(true);
  });

  it('Produces a value point suitable for the portfolio chart', () => {
    const point = toValuePoint(result.overview);
    expect(point.markValueUsd).toBeGreaterThan(0);
    expect(point.netPnlUsd).not.toBeNull();
  });

  it('Exposes structured portfolio data with explicit refusal guidance for the AI', () => {
    const view = buildAiPortfolioView(result);

    expect(view.totals.markValue.usd).toBeGreaterThan(0);
    expect(view.positions.length).toBeGreaterThan(0);
    expect(view.refusalGuidance.join(' ')).toContain('Never recommend buying, selling or holding');
    expect(view.refusalGuidance.join(' ')).toContain('sample size');

    // An unavailable value must reach the AI as a status, not a number.
    const ghost = view.positions.find((position) => position.symbol === 'GHOST');
    expect(ghost?.markValue.usd).toBeNull();
    expect(ghost?.markValue.status).toBe('UNAVAILABLE');
    expect(ghost?.markValue.display).toBe('Unavailable');
  });

  it('Generates the definition-of-done narrative', () => {
    const narrative = buildPortfolioNarrative(result);
    expect(narrative.headline.some((line) => line.startsWith('Market value:'))).toBe(true);
    expect(narrative.headline.some((line) => line.startsWith('Estimated exit value:'))).toBe(true);
    expect(narrative.headline.some((line) => line.startsWith('Net P&L:'))).toBe(true);
    expect(narrative.whatChanged.length).toBeGreaterThan(0);
    expect(narrative.why.length).toBeGreaterThan(0);
  });
});
