'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ShieldAlert } from 'lucide-react';
import { useWalletState } from '@/lib/store';

export function DepositTab() {
  const { primaryWallet } = useWalletState();
  const [copied, setCopied] = useState(false);
  const address = primaryWallet?.address;

  if (!address) return <p className="rounded-md border border-sentinel-800 p-4 text-xs text-slate-400">Connect a Solana wallet to view its deposit address.</p>;

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col items-center gap-4 rounded-md border border-sentinel-800 bg-sentinel-950 p-4 sm:flex-row">
        <div className="shrink-0 rounded-md bg-white p-2"><QRCodeSVG value={`solana:${address}`} size={128} level="M" /></div>
        <div className="min-w-0 space-y-3">
          <p className="text-[11px] uppercase text-slate-400">Connected Solana wallet address</p>
          <p className="break-all font-mono text-sky-300">{address}</p>
          <button type="button" className="flex min-h-11 items-center gap-2 rounded-md border border-sentinel-700 px-3 text-slate-200 hover:bg-sentinel-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            onClick={async () => { await navigator.clipboard.writeText(address); setCopied(true); }}>
            {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy address'}
          </button>
        </div>
      </div>
      <p className="flex items-start gap-2 rounded-md border border-amber-800 bg-amber-950/20 p-3 text-amber-200">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        Verify the Solana cluster and token in your sending wallet. A deposit appears only after an actual on-chain transfer; this screen does not credit funds.
      </p>
    </div>
  );
}
