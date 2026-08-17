'use client';

import React from 'react';
import type { PriceImpactEstimate } from '@/lib/intelligence/types';
import { LogOut, Info } from 'lucide-react';

interface PriceImpactTableProps {
  estimates: PriceImpactEstimate[];
}

export function PriceImpactTable({ estimates }: PriceImpactTableProps) {
  if (!estimates || estimates.length === 0) {
    return null;
  }

  return (
    <div className="bg-sentinel-900 border border-sentinel-700/60 rounded-xl p-5 shadow-card my-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-sentinel-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LogOut className="w-5 h-5 text-sky-400" />
            <span>Exitability & Price Impact Analysis</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulated price impact and output amounts for hypothetical sell orders.
          </p>
        </div>
        <span className="text-2xs font-mono uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded">
          Simulation Model
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-sentinel-800 text-slate-400 uppercase text-2xs tracking-wider">
              <th className="pb-2.5 font-semibold">Hypothetical Sell</th>
              <th className="pb-2.5 font-semibold">Est. Output (USD)</th>
              <th className="pb-2.5 font-semibold">Price Impact</th>
              <th className="pb-2.5 font-semibold">Liquidity Consumed</th>
              <th className="pb-2.5 font-semibold">Exit Feasibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sentinel-800/60 text-slate-200">
            {estimates.map((est) => {
              const feasibility = getFeasibility(est.priceImpactPct);

              return (
                <tr key={est.sellAmountUsd} className="hover:bg-sentinel-950/60 transition-colors">
                  <td className="py-3 font-bold text-white">${est.sellAmountUsd.toLocaleString()}</td>
                  <td className="py-3 font-semibold text-emerald-400">
                    ${est.estimatedOutputUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3">
                    <span className={`font-bold ${
                      est.priceImpactPct > 15 ? 'text-rose-400' :
                      est.priceImpactPct > 5 ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {est.priceImpactPct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">{est.liquidityConsumedPct.toFixed(2)}%</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-2xs font-semibold font-sans ${feasibility.className}`}>
                      {feasibility.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-sentinel-800/60 text-2xs text-slate-400 flex items-center gap-1.5 font-sans">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>
          Estimates assume standard constant-product AMM bonding curves without considering multi-hop DEX routing or MEV slippage. Actual execution output may vary.
        </span>
      </div>
    </div>
  );
}

function getFeasibility(impactPct: number) {
  if (impactPct < 2) return { label: 'Seamless', className: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' };
  if (impactPct < 5) return { label: 'Normal', className: 'bg-sky-500/20 text-sky-300 border border-sky-500/30' };
  if (impactPct < 15) return { label: 'Elevated Impact', className: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' };
  return { label: 'High Slippage', className: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' };
}
