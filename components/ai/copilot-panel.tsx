'use client';

import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useDialogFocus } from '@/lib/hooks/use-dialog-focus';
import { useCopilotContext } from './copilot-context';

const CopilotChat = dynamic(() => import('./copilot-chat').then(module => module.CopilotChat), {
  loading: () => <p role="status" className="p-4 text-sm text-slate-400">Opening Copilot...</p>,
});

export function CopilotPanel() {
  const context = useCopilotContext();
  const [open, setOpen] = useState(false);
  const ref = useDialogFocus(open && context.page !== 'ai', () => setOpen(false));
  if (context.page === 'ai') return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      className="fixed bottom-12 right-4 z-30 flex min-h-11 items-center gap-2 rounded-md border border-sky-400/30 bg-sentinel-900 px-4 text-sm text-sky-300 shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
      <MessageSquare size={16} /> Copilot
    </button>
    {open && <div className="fixed inset-0 z-[90] bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="copilot-panel-title" tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-700 bg-sentinel-950 shadow-2xl sm:w-[440px]">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <h2 id="copilot-panel-title" className="text-base font-semibold">Sentinel Copilot</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close Copilot" className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-slate-800 focus-visible:outline focus-visible:outline-sky-400"><X size={18} /></button>
        </header>
        <CopilotChat context={context} />
      </div>
    </div>}
  </>;
}
