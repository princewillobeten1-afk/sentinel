'use client';

import React, { useState } from 'react';
import { Wallet, LogOut, ChevronDown, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWalletState, useWalletActions } from '@/lib/store';

interface WalletConnectButtonProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function WalletConnectButton({
  onConnect,
  onDisconnect,
  className = '',
  size = 'sm',
}: WalletConnectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { primaryWallet, status } = useWalletState();
  const { setWalletModalOpen, disconnectWallet } = useWalletActions();

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
    onDisconnect?.();
    setIsOpen(false);
  };

  if (primaryWallet && status === 'authenticated') {
    const shortAddr = `${primaryWallet.address.slice(0, 4)}...${primaryWallet.address.slice(-4)}`;

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sentinel-900 border border-emerald-500/30 hover:border-emerald-400 transition font-mono text-xs text-white shadow-[0_0_15px_rgba(52,211,153,0.15)] ${className}`}
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-sky-300">{shortAddr}</span>
          <span className="font-numeric font-bold text-emerald-400 border-l border-emerald-500/30 pl-2">
            {primaryWallet.balanceSol.toFixed(2)} SOL
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-60 p-2.5 rounded-2xl bg-sentinel-900 border border-sentinel-700/80 shadow-2xl backdrop-blur-xl z-50 font-mono text-xs space-y-2">
            <div className="p-2 bg-sentinel-950/80 rounded-xl border border-sentinel-800">
              <span className="text-2xs text-slate-500 block uppercase font-bold">Active Solana Wallet</span>
              <p className="font-bold text-white truncate text-2xs mt-0.5">{primaryWallet.address}</p>
              <div className="flex items-center justify-between text-2xs text-emerald-400 font-bold mt-1">
                <span>Balance:</span>
                <span>{primaryWallet.balanceSol.toFixed(4)} SOL</span>
              </div>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => handleCopy(primaryWallet.address)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-sentinel-800 transition text-left"
              >
                <span>Copy Address</span>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setWalletModalOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sky-400 hover:bg-sky-500/10 transition text-left"
              >
                <span>Manage & Deposit</span>
                <Wallet className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={handleDisconnect}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition text-left"
              >
                <span>Disconnect</span>
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Button
      onClick={() => setWalletModalOpen(true)}
      variant="buy"
      size={size}
      className={`font-bold shadow-glow ${className}`}
      leftIcon={<Wallet className="h-3.5 w-3.5" />}
    >
      Connect Wallet
    </Button>
  );
}
