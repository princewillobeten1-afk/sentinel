'use client';

import React, { useState } from 'react';
import { Shield, AlertTriangle, Zap, Check, Plus, Trash2, ArrowRight, X, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ProtectionMode, StopLossType, TakeProfitTarget, PositionProtection } from '@/lib/protection/types';

interface PositionProtectionModalProps {
  positionId: string;
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  positionTokens: number;
  existingProtection?: PositionProtection;
  onClose: () => void;
  onProtectionSaved: () => void;
}

export function PositionProtectionModal({
  positionId,
  tokenSymbol,
  entryPrice,
  currentPrice,
  positionTokens,
  existingProtection,
  onClose,
  onProtectionSaved
}: PositionProtectionModalProps) {
  const [protectionMode, setProtectionMode] = useState<ProtectionMode>(existingProtection?.protectionMode || 'BALANCED');
  const [autoBreakEven, setAutoBreakEven] = useState(existingProtection?.autoBreakEven ?? true);

  // Stop Loss State
  const [stopType, setStopType] = useState<StopLossType>(existingProtection?.stopLoss?.type || 'PERCENTAGE');
  const [stopPct, setStopPct] = useState(existingProtection?.stopLoss?.percentage?.toString() || '15');
  const [trailPct, setTrailPct] = useState(existingProtection?.stopLoss?.trailPct?.toString() || '10');
  const [fixedStopPrice, setFixedStopPrice] = useState(
    existingProtection?.stopLoss?.stopPrice?.toString() || (entryPrice * 0.85).toFixed(4)
  );

  // Take Profit Targets State
  const [takeProfits, setTakeProfits] = useState<TakeProfitTarget[]>(
    existingProtection?.takeProfits?.length
      ? existingProtection.takeProfits
      : [
          { level: 1, targetPrice: parseFloat((entryPrice * 1.30).toFixed(4)), portionPct: 25, status: 'PENDING' },
          { level: 2, targetPrice: parseFloat((entryPrice * 1.70).toFixed(4)), portionPct: 25, status: 'PENDING' },
          { level: 3, targetPrice: parseFloat((entryPrice * 2.50).toFixed(4)), portionPct: 50, status: 'PENDING' }
        ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmergencyExiting, setIsEmergencyExiting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate Net P&L estimates
  const calculatedStopPrice = stopType === 'PERCENTAGE' 
    ? entryPrice * (1 - parseFloat(stopPct || '15') / 100)
    : stopType === 'TRAILING'
    ? currentPrice * (1 - parseFloat(trailPct || '10') / 100)
    : parseFloat(fixedStopPrice || '0');

  const grossStopPnlPct = ((calculatedStopPrice - entryPrice) / entryPrice) * 100;
  const netStopPnlPct = grossStopPnlPct - 0.9; // factoring fees + gas + slippage

  const handleAddTpLevel = () => {
    const nextLevel = takeProfits.length + 1;
    const lastTarget = takeProfits.length > 0 ? takeProfits[takeProfits.length - 1].targetPrice : entryPrice * 1.5;
    const newTarget: TakeProfitTarget = {
      level: nextLevel,
      targetPrice: parseFloat((lastTarget * 1.3).toFixed(4)),
      portionPct: 25,
      status: 'PENDING'
    };
    setTakeProfits([...takeProfits, newTarget]);
  };

  const handleRemoveTpLevel = (index: number) => {
    const updated = takeProfits.filter((_, i) => i !== index).map((tp, idx) => ({ ...tp, level: idx + 1 }));
    setTakeProfits(updated);
  };

  const handleSaveProtection = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const stopLossConfig = {
        type: stopType,
        stopPrice: parseFloat(calculatedStopPrice.toFixed(4)),
        percentage: stopType === 'PERCENTAGE' ? parseFloat(stopPct) : undefined,
        trailPct: stopType === 'TRAILING' ? parseFloat(trailPct) : undefined,
        portionPct: 100
      };

      const res = await fetch(`/api/v1/positions/${positionId}/protection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: tokenSymbol.replace('$', ''),
          tokenSymbol,
          entryPrice,
          currentPrice,
          positionTokens,
          protectionMode,
          autoBreakEven,
          stopLoss: stopLossConfig,
          takeProfits
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save position protection');

      onProtectionSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteEmergencyExit = async () => {
    if (!confirm('Are you sure you want to execute an EMERGENCY EXIT? This will immediately market dump your position.')) {
      return;
    }

    setIsEmergencyExiting(true);
    try {
      const res = await fetch(`/api/v1/positions/${positionId}/emergency-exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPrice })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Emergency exit failed');

      onProtectionSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsEmergencyExiting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-sentinel-850 w-full max-w-xl rounded-2xl border border-sentinel-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-sentinel-750 bg-sentinel-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-bold text-white">Manage Protection Strategy ({tokenSymbol})</h2>
              <p className="text-2xs text-slate-400 font-numeric">
                Entry: <strong>${entryPrice.toFixed(4)}</strong> | Current: <strong className="text-emerald-400">${currentPrice.toFixed(4)}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto font-numeric">
          
          {/* Protection Mode Selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-bold block">Protection Execution Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['BEST_EXECUTION', 'BALANCED', 'EMERGENCY'] as ProtectionMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setProtectionMode(mode)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition ${
                    protectionMode === mode
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold shadow-glow'
                      : 'bg-sentinel-900 text-slate-400 border-sentinel-800 hover:text-slate-200'
                  }`}
                >
                  <p className="font-mono text-2xs uppercase">{mode.replace('_', ' ')}</p>
                  <p className="text-2xs text-slate-400 font-normal mt-0.5">
                    {mode === 'BEST_EXECUTION' ? 'Max Route Quality' : mode === 'BALANCED' ? 'Quality + Speed' : 'Max Exit Speed'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Stop Loss Configuration */}
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Stop Loss Protection
              </span>
              <span className="text-2xs font-mono text-slate-400">
                Stop: <strong className="text-rose-300">${calculatedStopPrice.toFixed(4)}</strong> (True Net: {netStopPnlPct > 0 ? '+' : ''}{netStopPnlPct.toFixed(1)}%)
              </span>
            </div>

            {/* Stop Type Switcher */}
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              {(['PERCENTAGE', 'TRAILING', 'FIXED'] as StopLossType[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setStopType(st)}
                  className={`py-1.5 rounded-lg border text-center transition ${
                    stopType === st ? 'bg-rose-500/30 text-rose-200 border-rose-500/50 font-bold' : 'bg-sentinel-900 text-slate-400 border-sentinel-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Dynamic Inputs based on type */}
            {stopType === 'PERCENTAGE' && (
              <div>
                <label className="text-2xs text-slate-400 mb-1 block">Stop Loss Drop (% below Entry)</label>
                <Input
                  isMonospace
                  type="number"
                  value={stopPct}
                  onChange={(e) => setStopPct(e.target.value)}
                  rightAddon={<span className="text-xs text-slate-400">%</span>}
                />
              </div>
            )}

            {stopType === 'TRAILING' && (
              <div>
                <label className="text-2xs text-slate-400 mb-1 block">Trailing Stop Distance (% below Highest Price)</label>
                <Input
                  isMonospace
                  type="number"
                  value={trailPct}
                  onChange={(e) => setTrailPct(e.target.value)}
                  rightAddon={<span className="text-xs text-slate-400">%</span>}
                />
              </div>
            )}

            {stopType === 'FIXED' && (
              <div>
                <label className="text-2xs text-slate-400 mb-1 block">Fixed Trigger Price ($)</label>
                <Input
                  isMonospace
                  type="number"
                  value={fixedStopPrice}
                  onChange={(e) => setFixedStopPrice(e.target.value)}
                  leftAddon={<span className="text-xs text-slate-400">$</span>}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={autoBreakEven}
                onChange={(e) => setAutoBreakEven(e.target.checked)}
                className="rounded border-sentinel-700 bg-sentinel-900 text-sky-500"
              />
              <span>Auto-adjust Stop Loss to Break-Even after TP1 execution</span>
            </label>
          </div>

          {/* Multiple Take Profits Section */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Multi-Stage Take Profit Targets
              </span>
              <Button variant="ghost" size="xs" onClick={handleAddTpLevel} leftIcon={<Plus className="w-3 h-3" />}>
                Add Level
              </Button>
            </div>

            <div className="space-y-2">
              {takeProfits.map((tp, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-sentinel-800 bg-sentinel-900 text-xs">
                  <span className="font-mono text-emerald-400 font-bold w-12">TP{tp.level}</span>
                  <div className="flex-1">
                    <Input
                      isMonospace
                      type="number"
                      value={tp.targetPrice}
                      onChange={(e) => {
                        const updated = [...takeProfits];
                        updated[idx].targetPrice = parseFloat(e.target.value) || 0;
                        setTakeProfits(updated);
                      }}
                      leftAddon={<span className="text-2xs text-slate-400">$</span>}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      isMonospace
                      type="number"
                      value={tp.portionPct}
                      onChange={(e) => {
                        const updated = [...takeProfits];
                        updated[idx].portionPct = parseFloat(e.target.value) || 0;
                        setTakeProfits(updated);
                      }}
                      rightAddon={<span className="text-2xs text-slate-400">%</span>}
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveTpLevel(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-sentinel-750 bg-sentinel-900 flex items-center justify-between gap-3">
          <Button
            variant="destructive"
            size="sm"
            isLoading={isEmergencyExiting}
            onClick={handleExecuteEmergencyExit}
            leftIcon={<Flame className="w-4 h-4" />}
          >
            🚨 EXIT NOW
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              onClick={handleSaveProtection}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Save Protection Strategy
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
