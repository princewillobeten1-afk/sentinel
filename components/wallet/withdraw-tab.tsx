'use client';

import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useAppActions, useWalletActions } from '@/lib/store';

/** The legacy form used a server-side balance simulation and invented signatures. */
export function WithdrawTab() {
  const { setActiveView } = useAppActions();
  const { setWalletModalOpen } = useWalletActions();

  return (
    <div className="space-y-4 rounded-md border border-sentinel-800 bg-sentinel-950 p-4 text-xs">
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-100">Send with your connected wallet</h3>
          <p className="leading-relaxed text-slate-400">Open Wallet Management and choose Send. Your wallet will show the transfer for approval and return the real network signature.</p>
          <p className="text-amber-300">The current Send flow uses Solana devnet. Check the network before signing.</p>
        </div>
      </div>
      <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-4 font-semibold text-sentinel-950 hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        onClick={() => { setWalletModalOpen(false); setActiveView('settings'); }}>
        Open Wallet Management <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
