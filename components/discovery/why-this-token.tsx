'use client';

import React, { useState } from 'react';
import { HelpCircle, ShieldCheck, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DiscoveryScore } from '@/lib/discovery/types';

interface WhyThisTokenProps {
  score: DiscoveryScore;
  symbol: string;
  className?: string;
}

export function WhyThisToken({ score, symbol, className = '' }: WhyThisTokenProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`font-mono text-xs ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-2xs text-sky-400 hover:text-sky-300 font-bold transition"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span>Why Sentinel Surfaced This</span>
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isOpen && (
        <div className="mt-2 p-3 rounded-xl border border-sky-500/30 bg-sky-950/20 space-y-2 text-slate-300 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-sky-900/40 pb-2">
            <span className="text-2xs text-slate-400 uppercase font-bold flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400" /> Recorded Signal Proof ($
              {symbol})
            </span>
            <Badge variant="info" size="sm">
              Score: {score.totalScore}/100
            </Badge>
          </div>

          <div className="space-y-1.5 pt-1">
            {score.explanations.map((exp, idx) => (
              <div key={idx} className="flex items-start gap-2 text-2xs text-slate-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{exp}</span>
              </div>
            ))}
          </div>

          <p className="text-2xs text-slate-500 pt-1 border-t border-sky-900/40">
            Calculated at {new Date(score.calculatedAt).toLocaleTimeString()} across normalized momentum, volume acceleration, and liquidity quality metrics.
          </p>
        </div>
      )}
    </div>
  );
}
