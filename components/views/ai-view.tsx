'use client';

import { useState } from 'react';
import { CopilotChat } from '@/components/ai/copilot-chat';
import { mintSchema, type PilotContext } from '@/lib/ai/pilot/contracts';
import { CHART_TIMEFRAMES, type ChartTimeframe } from '@/lib/market/chart-model';

export function AiView() {
  const [mint, setMint] = useState('');
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1m');
  const valid = !mint || mintSchema.safeParse(mint).success;
  const context: PilotContext = { page: 'ai', chain: 'solana', timeframe, displayUnit: 'price', ...(mint && valid ? { mint } : {}) };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-800 bg-sentinel-950 shadow-lg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5 shrink-0">
        <div>
          <h1 className="text-base font-semibold leading-tight">Phivex Copilot</h1>
          <p className="text-[11px] text-slate-400">Public-market research with traceable evidence · Early access</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="sr-only">Exact Solana token mint (optional)</span>
            <input
              aria-label="Exact Solana token mint (optional)"
              aria-invalid={!valid}
              value={mint}
              onChange={e => setMint(e.target.value.trim())}
              placeholder="Exact Solana token mint (optional)"
              maxLength={44}
              className="h-8 w-60 rounded-md border border-slate-700 bg-sentinel-900 px-2.5 font-mono text-xs text-slate-200 outline-none focus:border-sky-400"
            />
          </label>
          <label className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="sr-only">Timeframe</span>
            <select
              aria-label="Timeframe"
              value={timeframe}
              onChange={e => setTimeframe(e.target.value as ChartTimeframe)}
              className="h-8 rounded-md border border-slate-700 bg-sentinel-900 px-2 text-xs text-slate-200"
            >
              {CHART_TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </label>
        </div>
        {!valid && <p className="w-full text-xs text-amber-300">Enter a valid Solana mint. No token context is sent until it is valid.</p>}
      </header>
      <CopilotChat context={context} />
    </div>
  );
}
export default AiView;
