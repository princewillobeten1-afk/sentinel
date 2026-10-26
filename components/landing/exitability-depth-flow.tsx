'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sliders,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  ShieldAlert,
  Flame,
  Zap
} from 'lucide-react';

export function ExitabilityDepthFlow() {
  const [sellSize, setSellSize] = useState<number>(25000); // $25K default

  // Calculate dynamic simulated impacts
  const paperSlippage = (sellSize / 400000) * 1.5;
  const realSlippage = (Math.pow(sellSize / 60000, 1.8) * 3.8 + 0.4).toFixed(1);
  const mevLoss = Math.min(1800, Math.round(sellSize * 0.045));
  const netReceived = Math.round(sellSize * (1 - Number(realSlippage) / 100));

  const isSevere = Number(realSlippage) > 15;
  const isModerate = Number(realSlippage) > 5;

  const steps = [
    { size: 5000, label: '$5K', slippage: '0.8%' },
    { size: 15000, label: '$15K', slippage: '2.4%' },
    { size: 30000, label: '$30K', slippage: '6.9%' },
    { size: 50000, label: '$50K', slippage: '14.2%' },
    { size: 100000, label: '$100K', slippage: '38.5%' },
  ];

  return (
    <div className="w-full rounded-2xl border border-neutral-700 bg-neutral-900/90 shadow-2xl backdrop-blur-xl overflow-hidden font-mono">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-750 bg-neutral-850 px-6 py-4 gap-3">
        <div>
          <span className="text-3xs uppercase font-bold tracking-widest text-neutral-400">
            SIMULATED EXIT DEPTH ENGINE
          </span>
          <h3 className="text-base font-bold text-white tracking-wide">
            Paper Liquidity vs. Real Executable Exit Impact
          </h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-300 text-2xs font-bold">
          <Zap className="h-3.5 w-3.5 text-accent-400" />
          <span>Real-Time Route Simulation</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-750">
        {/* Left Slider & Controls (6 Cols) */}
        <div className="lg:col-span-6 p-6 space-y-6 bg-neutral-950/60">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-accent-400" />
                SIMULATE MARKET SELL ORDER:
              </label>
              <span className="text-lg font-black text-white px-3 py-1 rounded-lg bg-neutral-850 border border-neutral-700 text-accent-300">
                ${sellSize.toLocaleString()} USD
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={1000}
              max={100000}
              step={1000}
              value={sellSize}
              onChange={(e) => setSellSize(Number(e.target.value))}
              className="w-full h-2 rounded-lg bg-neutral-750 appearance-none cursor-pointer accent-accent-500 hover:accent-accent-400"
            />

            <div className="flex justify-between text-3xs text-neutral-500">
              <span>$1,000</span>
              <span>$25,000</span>
              <span>$50,000</span>
              <span>$100,000</span>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-3xs text-neutral-400 font-semibold">PRESETS:</span>
            {[5000, 15000, 30000, 50000, 80000].map((preset) => (
              <button
                key={preset}
                onClick={() => setSellSize(preset)}
                className={`px-2.5 py-1 rounded text-2xs font-bold transition-colors ${
                  sellSize === preset
                    ? 'bg-accent-500 text-white shadow-glow'
                    : 'bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-750'
                }`}
              >
                ${preset / 1000}K
              </button>
            ))}
          </div>

          {/* Depth Waterfall Comparison Bar */}
          <div className="space-y-3 pt-4 border-t border-neutral-800">
            <span className="text-2xs font-bold text-neutral-400">DEPTH STEPS SIMULATION:</span>
            <div className="space-y-2">
              {steps.map((st) => {
                const isActive = sellSize >= st.size;
                return (
                  <div key={st.size} className="flex items-center justify-between text-2xs p-2 rounded bg-neutral-850/80 border border-neutral-750">
                    <span className="font-bold text-neutral-300">{st.label} Exit</span>
                    <span className="text-neutral-400">Estimated Slippage:</span>
                    <span className={`font-bold ${isActive ? 'text-sell-400' : 'text-neutral-500'}`}>
                      {st.slippage}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Forensic Telemetry Card (6 Cols) */}
        <div className="lg:col-span-6 p-6 space-y-6 bg-neutral-900/60 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-3xs uppercase font-bold text-neutral-400">EXECUTABLE EXIT ANALYSIS</span>
              <span
                className={`px-2.5 py-0.5 rounded text-3xs font-bold border ${
                  isSevere
                    ? 'bg-sell-500/20 text-sell-300 border-sell-500/40 shadow-glow-sell'
                    : isModerate
                    ? 'bg-warn-500/20 text-warn-300 border-warn-500/40 shadow-glow-amber'
                    : 'bg-buy-500/20 text-buy-300 border-buy-500/40 shadow-glow-buy'
                }`}
              >
                {isSevere ? 'HIGH LIQUIDITY CRASH RISK' : isModerate ? 'MODERATE SLIPPAGE' : 'SAFE EXIT DEPTH'}
              </span>
            </div>

            {/* Impact Metric Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-neutral-850 border border-neutral-750 space-y-1">
                <span className="text-3xs uppercase text-neutral-400">Reported DEX Slippage</span>
                <p className="text-lg font-bold text-neutral-400 line-through">
                  ~{paperSlippage.toFixed(2)}%
                </p>
                <p className="text-3xs text-neutral-500">Deceptive paper calculation</p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-850 border border-sell-500/40 space-y-1 shadow-glow-sell">
                <span className="text-3xs uppercase text-sell-400 font-bold">Phivex Real Slippage</span>
                <p className="text-xl font-black text-sell-400">
                  -{realSlippage}%
                </p>
                <p className="text-3xs text-sell-300">Actual pool impact + fee tips</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-850 border border-neutral-750 space-y-2 text-2xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Order Nominal Value:</span>
                <span className="text-white font-bold">${sellSize.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Slippage & Price Erosion:</span>
                <span className="text-sell-400 font-bold">-${Math.round((sellSize * Number(realSlippage)) / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Jito Anti-MEV Protection Savings:</span>
                <span className="text-buy-400 font-bold">+${mevLoss.toLocaleString()} preserved</span>
              </div>
              <div className="pt-2 border-t border-neutral-750 flex justify-between text-xs font-black">
                <span className="text-white">Net Settled to Wallet:</span>
                <span className="text-buy-400 font-bold">${netReceived.toLocaleString()} USD</span>
              </div>
            </div>
          </div>

          {/* Phivex Recommendation */}
          <div className="p-3.5 rounded-xl bg-neutral-850 border border-neutral-750 text-2xs text-neutral-300 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-buy-400 flex-shrink-0" />
            <p className="font-sans leading-relaxed">
              Phivex automatically fragments large sell orders across multiple DEX pools (Raydium + Meteora + Whirlpools) to preserve up to <strong>14.2% more capital</strong> than a naive single swap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
