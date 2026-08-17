'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWalletBalance } from '@/lib/hooks/use-wallet-balance';
import type { LinkedWallet } from '@/lib/wallet/types';

interface WalletReceiveModalProps {
  wallet: LinkedWallet;
  isOpen: boolean;
  onClose: () => void;
  onCopy: (address: string) => void;
}

/**
 * Real-balance receive view for a linked wallet (devnet-first — see
 * docs/security/threat-model.md's "Wallet transfers" section). Read-only:
 * displays an already-known public key + QR code and a live balance read.
 * No signing, no fund movement — funds sent to this address never touch
 * Project Sentinel.
 */
export function WalletReceiveModal({ wallet, isOpen, onClose, onCopy }: WalletReceiveModalProps) {
  const { balance, isLoading, error } = useWalletBalance(wallet.id, isOpen);
  const isDevnet = (balance?.network ?? '').includes('devnet');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receive" subtitle={wallet.label} size="sm">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <Badge variant={isDevnet ? 'warning' : 'danger'} className="font-mono">
            {balance?.network ?? 'Loading network…'}
          </Badge>
        </div>

        <div className="flex justify-center rounded-xl bg-white p-4 w-fit mx-auto">
          <QRCodeSVG value={wallet.address} size={200} />
        </div>

        <div className="space-y-1">
          <p className="text-2xs uppercase text-slate-500 font-mono">Your Address</p>
          <div className="flex items-center justify-center gap-2 font-mono text-xs text-slate-200 break-all">
            <span>{wallet.address}</span>
            <button onClick={() => onCopy(wallet.address)} className="text-slate-500 hover:text-sky-300 transition shrink-0" title="Copy Address">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 space-y-1 font-mono">
          <p className="text-2xs uppercase text-slate-500">Live Balance</p>
          {error ? (
            <p className="text-xs text-rose-400">{error}</p>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm font-bold text-emerald-400">
                {isLoading && balance === null ? '…' : `${(balance?.sol ?? 0).toFixed(4)} SOL`}
              </span>
              <span className="text-sm font-bold text-sky-400">
                {isLoading && balance === null ? '…' : `${(balance?.usdc ?? 0).toFixed(2)} USDC`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-sentinel-800 bg-sentinel-950/60 p-3 text-left">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-2xs text-slate-400 leading-relaxed">
            This is your own wallet address. Send SOL or USDC to it from any exchange or wallet — Project Sentinel never holds or touches these funds.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={onClose} className="w-full">
          Close
        </Button>
      </div>
    </Modal>
  );
}
