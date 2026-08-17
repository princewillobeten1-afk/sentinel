'use client';

import React, { useState } from 'react';
import { Settings2, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SlippageControlProps {
  slippage: number;
  onChange: (value: number) => void;
}

const PRESET_OPTIONS = [0.1, 0.5, 1.0];

export function SlippageControl({
  slippage,
  onChange,
}: SlippageControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState(
    PRESET_OPTIONS.includes(slippage) ? '' : slippage.toString()
  );

  const isHighSlippage = slippage > 2.0;

  const handlePresetSelect = (val: number) => {
    setCustomValue('');
    onChange(val);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomValue(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 50) {
      onChange(parsed);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/10 hover:border-sky-500/30 transition text-xs font-mono text-slate-300"
      >
        <Settings2 className="h-3 w-3 text-slate-400" />
        <span>Slippage: <strong className="text-white">{slippage}%</strong></span>
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-64 p-3 rounded-2xl bg-sentinel-900 border border-white/10 shadow-2xl backdrop-blur-xl z-50 font-mono text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-slate-400 uppercase font-bold tracking-wider">
              Slippage Tolerance
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-2xs text-slate-500 hover:text-white"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {PRESET_OPTIONS.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetSelect(preset)}
                className={`py-1 rounded-lg font-semibold transition ${
                  slippage === preset && !customValue
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {preset}%
              </button>
            ))}

            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                placeholder="Custom"
                value={customValue}
                onChange={handleCustomChange}
                className={`w-full py-1 px-1.5 rounded-lg bg-white/[0.03] border text-center text-xs font-mono focus:outline-none ${
                  customValue
                    ? 'border-sky-500 text-white bg-sky-500/10'
                    : 'border-white/5 text-slate-300'
                }`}
              />
            </div>
          </div>

          {isHighSlippage && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-amber-300 text-2xs leading-relaxed">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                High slippage increases the risk of frontrunning and unfavorable execution.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
