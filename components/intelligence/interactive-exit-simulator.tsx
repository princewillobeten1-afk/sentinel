'use client';

import React, { useState, useMemo } from 'react';
import { LogOut, Sliders, Info, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { IntelligenceExitSimulator, ExitImpactTier } from '@/lib/intelligence/live-model';

interface InteractiveExitSimulatorProps {
  simulator?: IntelligenceExitSimulator;
  symbol: string;
}

export function InteractiveExitSimulator({ simulator, symbol }: InteractiveExitSimulatorProps) {
  const liquidity = simulator?.liquidityUsd ?? 50000;
  const depth = simulator?.poolDepthUsd ?? Math.max(liquidity * 0.7, 5000);
  const tiers = simulator?.tiers ?? [];

  // Interactive Custom Amount state
  const [customAmount, setCustomAmount] = useState<number>(1000);

  // Compute live simulation for the custom amount
  const customEstimate: ExitImpactTier = useMemo(() => {
    const amt = Math.max(1, customAmount);
    const impact = Math.min(99, Math.round((amt / (2 * depth)) * 10000) / 100);
    const output = Math.max(0, Math.round(amt * (1 - (impact / 100)) * 0.995 * 100) / 100);
    const consumed = Math.min(100, Math.round((amt / Math.max(liquidity, 1)) * 10000) / 100);

    let feasibility: ExitImpactTier['feasibility'] = 'Seamless';
    if (impact > 15) feasibility = 'High Slippage';
    else if (impact > 5) feasibility = 'Elevated Impact';
    else if (impact > 2) feasibility = 'Normal';

    return {
      sellAmountUsd: amt,
      estimatedOutputUsd: output,
      priceImpactPct: impact,
      liquidityConsumedPct: consumed,
      feasibility,
    };
  }, [customAmount, depth, liquidity]);

  const feasibilityStyle = (feasibility: ExitImpactTier['feasibility']) => {
    switch (feasibility) {
      case 'Seamless':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Normal':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'Elevated Impact':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'High Slippage':
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-sentinel-700/60 bg-sentinel-900/90 p-5 sm:p-6 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sentinel-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-semibold tracking-wider text-sky-400">Exitability Engine</span>
            <span className="rounded bg-sentinel-800 px-2 py-0.5 font-mono text-2xs text-slate-300">v2.1</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-white flex items-center gap-2">
            <LogOut className="h-5 w-5 text-sky-400" />
            <span>Real-Time Exitability & Slippage Simulator</span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Simulate hypothetical sell orders against measured liquidity depth. Never get trapped in illiquid pools.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="rounded-lg border border-sentinel-800 bg-sentinel-950/80 px-3 py-1.5 text-right">
            <span className="block text-2xs text-slate-400">Available Pool Liquidity</span>
            <span className="font-bold text-white text-sm">${Math.round(liquidity).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Interactive Custom Order Simulator Widget */}
      <div className="rounded-xl border border-sky-500/30 bg-sentinel-950/70 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300">
            <Sliders className="h-4 w-4 text-sky-400" />
            <span>Interactive Custom Order Tester</span>
          </div>
          <div className="flex items-center gap-2">
            {[100, 500, 1000, 2500, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCustomAmount(preset)}
                className={`rounded px-2.5 py-1 font-mono text-2xs font-semibold transition ${
                  customAmount === preset
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-sentinel-800 text-slate-300 hover:bg-sentinel-700'
                }`}
              >
                ${preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Slider and Number Input */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-3 space-y-2">
            <div className="flex justify-between text-2xs font-mono text-slate-400">
              <span>$50 Min</span>
              <span className="font-bold text-slate-200">Order Size: ${customAmount.toLocaleString()}</span>
              <span>${Math.round(Math.min(liquidity * 0.5, 25000)).toLocaleString()} Max</span>
            </div>
            <input
              type="range"
              min={50}
              max={Math.max(5000, Math.round(Math.min(liquidity * 0.5, 25000)))}
              step={50}
              value={customAmount}
              onChange={(e) => setCustomAmount(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-sentinel-800 accent-sky-400"
            />
          </div>

          <div className="relative">
            <span className="absolute left-3 top-2.5 font-mono text-xs text-slate-400">$</span>
            <input
              type="number"
              min={10}
              max={1000000}
              value={customAmount}
              onChange={(e) => setCustomAmount(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-sentinel-700 bg-sentinel-900 py-2 pl-7 pr-3 font-mono text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
        </div>

        {/* Dynamic Simulation Result Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-lg border border-sentinel-800 bg-sentinel-900/60 p-3">
            <span className="block text-2xs text-slate-400 font-medium">Est. Net Proceeds</span>
            <span className="font-mono text-base font-bold text-emerald-400">
              ${customEstimate.estimatedOutputUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="rounded-lg border border-sentinel-800 bg-sentinel-900/60 p-3">
            <span className="block text-2xs text-slate-400 font-medium">Estimated Price Impact</span>
            <span className={`font-mono text-base font-bold ${
              customEstimate.priceImpactPct > 15 ? 'text-rose-400' :
              customEstimate.priceImpactPct > 5 ? 'text-amber-400' : 'text-slate-100'
            }`}>
              {customEstimate.priceImpactPct.toFixed(2)}%
            </span>
          </div>

          <div className="rounded-lg border border-sentinel-800 bg-sentinel-900/60 p-3">
            <span className="block text-2xs text-slate-400 font-medium">Pool Share Consumed</span>
            <span className="font-mono text-base font-bold text-slate-200">
              {customEstimate.liquidityConsumedPct.toFixed(2)}%
            </span>
          </div>

          <div className="rounded-lg border border-sentinel-800 bg-sentinel-900/60 p-3 flex flex-col justify-between">
            <span className="block text-2xs text-slate-400 font-medium">Execution Feasibility</span>
            <span className={`inline-flex w-fit items-center rounded border px-2 py-0.5 text-2xs font-bold font-mono ${feasibilityStyle(customEstimate.feasibility)}`}>
              {customEstimate.feasibility}
            </span>
          </div>
        </div>
      </div>

      {/* Standard Simulation Tiers Table */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Standard Position Sizing Impact Matrix (${symbol})
        </h3>
        <div className="overflow-x-auto rounded-xl border border-sentinel-800 bg-sentinel-950/50">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-sentinel-800 text-slate-400 uppercase text-2xs tracking-wider">
                <th className="py-2.5 px-3 font-semibold">Hypothetical Sell</th>
                <th className="py-2.5 px-3 font-semibold">Est. Return (USD)</th>
                <th className="py-2.5 px-3 font-semibold">Price Impact</th>
                <th className="py-2.5 px-3 font-semibold">Liquidity Consumed</th>
                <th className="py-2.5 px-3 font-semibold">Exit Feasibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sentinel-800/60 text-slate-200">
              {tiers.map((tier) => (
                <tr key={tier.sellAmountUsd} className="hover:bg-sentinel-900/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-white">${tier.sellAmountUsd.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-semibold text-emerald-400">
                    ${tier.estimatedOutputUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`font-bold ${
                      tier.priceImpactPct > 15 ? 'text-rose-400' :
                      tier.priceImpactPct > 5 ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {tier.priceImpactPct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{tier.liquidityConsumedPct.toFixed(2)}%</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex rounded border px-2 py-0.5 text-2xs font-bold ${feasibilityStyle(tier.feasibility)}`}>
                      {tier.feasibility}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimers & Model Context */}
      <div className="flex items-start gap-2 border-t border-sentinel-800/80 pt-3 text-2xs text-slate-400">
        <Info className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
        <p>
          Simulations model Raydium & Pump.fun constant-product AMM reserves (x · y = k). Actual execution may vary depending on MEV protection, priority fees, and multi-hop DEX routing. Always set appropriate slippage tolerances.
        </p>
      </div>
    </div>
  );
}
