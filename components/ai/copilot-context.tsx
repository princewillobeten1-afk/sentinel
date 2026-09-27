'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PilotContext } from '@/lib/ai/pilot/contracts';

type ChartContext = Pick<PilotContext, 'mint' | 'timeframe' | 'displayUnit'>;
const Context = createContext<{ context: PilotContext; publish: (value: ChartContext) => () => void } | null>(null);

export function CopilotContextProvider({ page, children }: { page: PilotContext['page']; children: React.ReactNode }) {
  const [chart, setChart] = useState<ChartContext | null>(null);
  const publish = useCallback((value: ChartContext) => {
    setChart(value);
    return () => setChart(previous => previous === value ? null : previous);
  }, []);
  const value = useMemo(() => ({ publish, context: {
    page, chain: 'solana' as const, timeframe: '1m' as const, displayUnit: 'price' as const,
    ...(page === 'trade' ? chart : {}),
  } }), [chart, page, publish]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCopilotChartContext(mint: string, timeframe: PilotContext['timeframe'], displayUnit: PilotContext['displayUnit']) {
  const publish = useContext(Context)?.publish;
  useEffect(() => publish?.({ mint, timeframe, displayUnit }), [publish, mint, timeframe, displayUnit]);
}
export function useCopilotContext(): PilotContext {
  return useContext(Context)?.context ?? { page: 'ai', chain: 'solana', timeframe: '1m', displayUnit: 'price' };
}
