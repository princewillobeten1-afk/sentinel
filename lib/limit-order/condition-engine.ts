import { LimitOrder, ConditionEvaluationReport, ConditionEvaluationItem } from './types';

export interface MarketSnapshot {
  currentPrice: number;
  liquidityUsd?: number;
  exitabilityScore?: number;
  insiderRiskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  organicVolumeRatio?: number;
  creatorRepScore?: number;
  expectedPriceImpactPct?: number;
}

const RISK_LEVEL_WEIGHTS = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4
};

export class ConditionEngine {
  public evaluate(order: LimitOrder, market: MarketSnapshot): ConditionEvaluationReport {
    const items: ConditionEvaluationItem[] = [];
    let hasUnknown = false;
    let allPassed = true;

    // 1. Price Trigger Check
    const isBuy = order.side === 'buy';
    const pricePassed = isBuy 
      ? market.currentPrice <= order.targetPrice
      : market.currentPrice >= order.targetPrice;

    items.push({
      id: 'price',
      label: 'Target Price Target',
      required: `${isBuy ? '≤' : '≥'} $${order.targetPrice.toFixed(4)}`,
      current: `$${market.currentPrice.toFixed(4)}`,
      status: pricePassed ? 'PASSED' : 'FAILED',
      message: pricePassed 
        ? `Target price reached ($${market.currentPrice.toFixed(4)})` 
        : `Waiting for price to hit target`
    });

    if (!pricePassed) allPassed = false;

    // 2. Minimum Liquidity Condition
    if (order.conditions.minLiquidityUsd !== undefined) {
      if (market.liquidityUsd === undefined) {
        hasUnknown = true;
        allPassed = false;
        items.push({
          id: 'liquidity',
          label: 'Minimum Liquidity',
          required: `≥ $${order.conditions.minLiquidityUsd.toLocaleString()}`,
          current: 'UNKNOWN',
          status: 'UNKNOWN',
          message: 'Liquidity telemetry currently unavailable. Halting execution for safety.'
        });
      } else {
        const passed = market.liquidityUsd >= order.conditions.minLiquidityUsd;
        if (!passed) allPassed = false;
        items.push({
          id: 'liquidity',
          label: 'Minimum Liquidity',
          required: `≥ $${order.conditions.minLiquidityUsd.toLocaleString()}`,
          current: `$${market.liquidityUsd.toLocaleString()}`,
          status: passed ? 'PASSED' : 'FAILED',
          message: passed 
            ? `Liquidity is sufficient ($${market.liquidityUsd.toLocaleString()})`
            : `Liquidity ($${market.liquidityUsd.toLocaleString()}) below threshold`
        });
      }
    }

    // 3. Minimum Exitability Condition
    if (order.conditions.minExitabilityScore !== undefined) {
      if (market.exitabilityScore === undefined) {
        hasUnknown = true;
        allPassed = false;
        items.push({
          id: 'exitability',
          label: 'Minimum Exitability Score',
          required: `≥ ${order.conditions.minExitabilityScore}/100`,
          current: 'UNKNOWN',
          status: 'UNKNOWN',
          message: 'Exitability score unavailable.'
        });
      } else {
        const passed = market.exitabilityScore >= order.conditions.minExitabilityScore;
        if (!passed) allPassed = false;
        items.push({
          id: 'exitability',
          label: 'Minimum Exitability Score',
          required: `≥ ${order.conditions.minExitabilityScore}/100`,
          current: `${market.exitabilityScore}/100`,
          status: passed ? 'PASSED' : 'FAILED',
          message: passed
            ? `Exitability score passed (${market.exitabilityScore})`
            : `Exitability score (${market.exitabilityScore}) below safe threshold`
        });
      }
    }

    // 4. Maximum Insider Risk Condition
    if (order.conditions.maxInsiderRiskLevel !== undefined) {
      if (market.insiderRiskLevel === undefined) {
        hasUnknown = true;
        allPassed = false;
        items.push({
          id: 'insiderRisk',
          label: 'Maximum Insider Risk',
          required: `≤ ${order.conditions.maxInsiderRiskLevel}`,
          current: 'UNKNOWN',
          status: 'UNKNOWN',
          message: 'Insider risk audit pending.'
        });
      } else {
        const currentWeight = RISK_LEVEL_WEIGHTS[market.insiderRiskLevel] || 4;
        const reqWeight = RISK_LEVEL_WEIGHTS[order.conditions.maxInsiderRiskLevel] || 2;
        const passed = currentWeight <= reqWeight;
        if (!passed) allPassed = false;
        items.push({
          id: 'insiderRisk',
          label: 'Maximum Insider Risk',
          required: `≤ ${order.conditions.maxInsiderRiskLevel}`,
          current: market.insiderRiskLevel,
          status: passed ? 'PASSED' : 'FAILED',
          message: passed 
            ? `Insider risk level OK (${market.insiderRiskLevel})`
            : `Insider risk (${market.insiderRiskLevel}) exceeds threshold (${order.conditions.maxInsiderRiskLevel})`
        });
      }
    }

    // 5. Minimum Organic Volume Condition
    if (order.conditions.minOrganicVolumeRatio !== undefined) {
      if (market.organicVolumeRatio === undefined) {
        hasUnknown = true;
        allPassed = false;
        items.push({
          id: 'organicVolume',
          label: 'Organic Volume Ratio',
          required: `≥ ${Math.round(order.conditions.minOrganicVolumeRatio * 100)}%`,
          current: 'UNKNOWN',
          status: 'UNKNOWN',
          message: 'Organic volume measurement unavailable.'
        });
      } else {
        const currentPct = Math.round(market.organicVolumeRatio * 100);
        const reqPct = Math.round(order.conditions.minOrganicVolumeRatio * 100);
        const passed = currentPct >= reqPct;
        if (!passed) allPassed = false;
        items.push({
          id: 'organicVolume',
          label: 'Organic Volume Ratio',
          required: `≥ ${reqPct}%`,
          current: `${currentPct}%`,
          status: passed ? 'PASSED' : 'FAILED',
          message: passed
            ? `Organic volume ratio passed (${currentPct}%)`
            : `Organic volume ratio (${currentPct}%) below target (${reqPct}%)`
        });
      }
    }

    // 6. Max Price Impact Condition
    if (order.conditions.maxPriceImpactPct !== undefined) {
      if (market.expectedPriceImpactPct === undefined) {
        hasUnknown = true;
        allPassed = false;
        items.push({
          id: 'priceImpact',
          label: 'Maximum Price Impact',
          required: `≤ ${order.conditions.maxPriceImpactPct}%`,
          current: 'UNKNOWN',
          status: 'UNKNOWN',
          message: 'Price impact estimate unavailable.'
        });
      } else {
        const passed = market.expectedPriceImpactPct <= order.conditions.maxPriceImpactPct;
        if (!passed) allPassed = false;
        items.push({
          id: 'priceImpact',
          label: 'Maximum Price Impact',
          required: `≤ ${order.conditions.maxPriceImpactPct}%`,
          current: `${market.expectedPriceImpactPct.toFixed(2)}%`,
          status: passed ? 'PASSED' : 'FAILED',
          message: passed
            ? `Price impact within limit (${market.expectedPriceImpactPct.toFixed(2)}%)`
            : `Price impact (${market.expectedPriceImpactPct.toFixed(2)}%) exceeds limit (${order.conditions.maxPriceImpactPct}%)`
        });
      }
    }

    return {
      passed: allPassed && !hasUnknown,
      hasUnknown,
      items
    };
  }
}

export const conditionEngine = new ConditionEngine();
