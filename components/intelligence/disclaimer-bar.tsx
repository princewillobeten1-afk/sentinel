'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

export function DisclaimerBar() {
  return (
    <div className="bg-amber-950/30 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200/80 flex items-center gap-2.5 my-4">
      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
      <div>
        <span className="font-semibold text-amber-300">Important Disclaimer:</span> Intelligence scores and risk levels reflect observable blockchain and market data patterns. They are <span className="underline decoration-amber-500/40 font-medium text-amber-200">not financial recommendations</span> and do not guarantee future safety or performance.
      </div>
    </div>
  );
}
