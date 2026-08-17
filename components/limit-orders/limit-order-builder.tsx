'use client';

import React, { useState } from 'react';
import { Target, Shield, Zap, Info, Sliders, AlertCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LimitOrderConditions } from '@/lib/limit-order/types';

interface LimitOrderBuilderProps {
  currentPrice: number;
  walletBalanceSol: number;
  onClose: () => void;
  onOrderCreated: () => void;
}

export function LimitOrderBuilder({ currentPrice, walletBalanceSol, onClose, onOrderCreated }: LimitOrderBuilderProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [targetPriceStr, setTargetPriceStr] = useState((currentPrice * 0.95).toFixed(4));
  const [amountSolStr, setAmountSolStr] = useState('1.0');
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [expiration, setExpiration] = useState('24h');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Advanced Safety Conditions
  const [enableLiquidity, setEnableLiquidity] = useState(true);
  const [minLiquidityUsd, setMinLiquidityUsd] = useState('500000');

  const [enableExitability, setEnableExitability] = useState(true);
  const [minExitabilityScore, setMinExitabilityScore] = useState('70');

  const [enableInsiderRisk, setEnableInsiderRisk] = useState(true);
  const [maxInsiderRisk, setMaxInsiderRisk] = useState<'Low' | 'Medium' | 'High'>('Medium');

  const [enableOrganicVolume, setEnableOrganicVolume] = useState(false);
  const [minOrganicVolumeRatio, setMinOrganicVolumeRatio] = useState('60');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const targetPrice = parseFloat(targetPriceStr);
    const amountIn = parseFloat(amountSolStr);

    if (!targetPrice || targetPrice <= 0 || !amountIn || amountIn <= 0) {
      setErrorMsg('Please enter valid target price and order size.');
      setIsSubmitting(false);
      return;
    }

    const conditions: LimitOrderConditions = {
      maxPriceImpactPct: 3.0
    };

    if (mode === 'advanced') {
      if (enableLiquidity) conditions.minLiquidityUsd = parseFloat(minLiquidityUsd);
      if (enableExitability) conditions.minExitabilityScore = parseInt(minExitabilityScore, 10);
      if (enableInsiderRisk) conditions.maxInsiderRiskLevel = maxInsiderRisk;
      if (enableOrganicVolume) conditions.minOrganicVolumeRatio = parseFloat(minOrganicVolumeRatio) / 100;
    }

    try {
      const res = await fetch('/api/v1/limit-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side,
          targetPrice,
          amountIn,
          conditions,
          expiresAt: expiration === '24h' ? new Date(Date.now() + 86400000).toISOString() : undefined
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create limit order');
      }

      onOrderCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-sentinel-850 w-full max-w-lg rounded-2xl border border-sentinel-700 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-sentinel-750 bg-sentinel-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">Create Intelligent Limit Order</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          
          {/* Mode Switcher */}
          <div className="flex justify-between items-center bg-sentinel-950 p-1 rounded-xl border border-sentinel-800 text-xs">
            <button
              onClick={() => setMode('simple')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                mode === 'simple' ? 'bg-sentinel-750 text-sky-300 border border-sentinel-600' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Simple Mode
            </button>
            <button
              onClick={() => setMode('advanced')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                mode === 'advanced' ? 'bg-sentinel-750 text-sky-300 border border-sentinel-600' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Advanced Conditions
            </button>
          </div>

          {/* Side Switcher (Buy vs Sell) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide('buy')}
              className={`py-2 rounded-xl font-bold text-xs transition ${
                side === 'buy' ? 'bg-trading-buy text-slate-950 shadow-glow-buy' : 'bg-sentinel-900 text-slate-400 border border-sentinel-800'
              }`}
            >
              LIMIT BUY
            </button>
            <button
              onClick={() => setSide('sell')}
              className={`py-2 rounded-xl font-bold text-xs transition ${
                side === 'sell' ? 'bg-trading-sell text-white shadow-glow-sell' : 'bg-sentinel-900 text-slate-400 border border-sentinel-800'
              }`}
            >
              LIMIT SELL
            </button>
          </div>

          {/* Form Inputs */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1 font-numeric">
                <span>Target Trigger Price:</span>
                <span>Current: <strong className="text-white">${currentPrice.toFixed(4)}</strong></span>
              </div>
              <Input
                isMonospace
                type="number"
                value={targetPriceStr}
                onChange={(e) => setTargetPriceStr(e.target.value)}
                leftAddon={<span className="text-xs font-mono text-slate-400">$</span>}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1 font-numeric">
                <span>Order Quantity:</span>
                <span>Available: <strong className="text-white">{walletBalanceSol} SOL</strong></span>
              </div>
              <Input
                isMonospace
                type="number"
                value={amountSolStr}
                onChange={(e) => setAmountSolStr(e.target.value)}
                rightAddon={<span className="text-xs font-mono text-slate-400">SOL</span>}
              />
            </div>
          </div>

          {/* Advanced Safety Conditions Section */}
          {mode === 'advanced' && (
            <div className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-950/10 p-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-sky-400 pb-1 border-b border-sky-500/20">
                <Shield className="w-4 h-4" /> Safety Guardrails (Must ALL Pass)
              </div>

              {/* Liquidity */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableLiquidity}
                    onChange={(e) => setEnableLiquidity(e.target.checked)}
                    className="rounded border-sentinel-700 bg-sentinel-900 text-sky-500"
                  />
                  <span>Min Liquidity</span>
                </label>
                <div className="w-32">
                  <Input
                    isMonospace
                    type="number"
                    value={minLiquidityUsd}
                    onChange={(e) => setMinLiquidityUsd(e.target.value)}
                    disabled={!enableLiquidity}
                    leftAddon={<span className="text-2xs text-slate-400">$</span>}
                  />
                </div>
              </div>

              {/* Exitability */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableExitability}
                    onChange={(e) => setEnableExitability(e.target.checked)}
                    className="rounded border-sentinel-700 bg-sentinel-900 text-sky-500"
                  />
                  <span>Min Exitability</span>
                </label>
                <div className="w-32">
                  <Input
                    isMonospace
                    type="number"
                    value={minExitabilityScore}
                    onChange={(e) => setMinExitabilityScore(e.target.value)}
                    disabled={!enableExitability}
                    rightAddon={<span className="text-2xs text-slate-400">/100</span>}
                  />
                </div>
              </div>

              {/* Insider Risk */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableInsiderRisk}
                    onChange={(e) => setEnableInsiderRisk(e.target.checked)}
                    className="rounded border-sentinel-700 bg-sentinel-900 text-sky-500"
                  />
                  <span>Max Insider Risk</span>
                </label>
                <select
                  value={maxInsiderRisk}
                  onChange={(e) => setMaxInsiderRisk(e.target.value as any)}
                  disabled={!enableInsiderRisk}
                  className="bg-sentinel-900 border border-sentinel-700 rounded-lg text-xs p-1.5 text-slate-200"
                >
                  <option value="Low">Low Only</option>
                  <option value="Medium">Medium or Lower</option>
                  <option value="High">Allow High</option>
                </select>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-sentinel-750 bg-sentinel-900 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant={side === 'buy' ? 'buy' : 'sell'}
            size="md"
            isLoading={isSubmitting}
            onClick={handleSubmit}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create Persistent Limit Order
          </Button>
        </div>

      </div>
    </div>
  );
}
