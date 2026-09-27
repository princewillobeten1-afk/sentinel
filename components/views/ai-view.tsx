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
  return <div className="mx-auto flex h-[calc(100dvh-140px)] min-h-[540px] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-800 bg-sentinel-950">
    <header className="space-y-3 border-b border-slate-800 p-4">
      <div><h1 className="text-xl font-semibold">Sentinel Copilot</h1><p className="mt-1 text-xs text-slate-400">Public-market research with traceable evidence. Early access.</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="min-w-0 flex-1 text-[11px] text-slate-400">Exact Solana token mint (optional)
          <input aria-invalid={!valid} value={mint} onChange={e => setMint(e.target.value.trim())} placeholder="Paste a token mint, not a wallet address" maxLength={44}
            className="mt-1 min-h-11 w-full rounded-md border border-slate-700 bg-sentinel-900 px-3 font-mono text-xs text-slate-200 outline-none focus:border-sky-400" />
        </label>
        <label className="text-[11px] text-slate-400">Timeframe
          <select value={timeframe} onChange={e => setTimeframe(e.target.value as ChartTimeframe)} className="mt-1 block min-h-11 rounded-md border border-slate-700 bg-sentinel-900 px-3 text-xs text-slate-200">
            {CHART_TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </label>
      </div>
      {!valid && <p className="text-xs text-amber-300">Enter a valid Solana mint. No token context is sent until it is valid.</p>}
    </header>
    <CopilotChat context={context} />
  </div>;
}
export default AiView;
