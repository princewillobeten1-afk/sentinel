'use client';

import React, { useState } from 'react';
import { Wallet, LogOut, ExternalLink, ShieldCheck, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { masterWalletProvider, WalletConnectionState } from '@/lib/wallet/wallet-provider';

interface WalletConnectButtonProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export function WalletConnectButton({
  onConnect,
  onDisconnect,
}: WalletConnectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<WalletConnectionState>(masterWalletProvider.getState());
  const [address, setAddress] = useState<string | null>(masterWalletProvider.getAddress());

  const handleConnect = async (chainFamily: 'solana' | 'evm' = 'solana') => {
    try {
      const res = await masterWalletProvider.connect(chainFamily);
      setState('CONNECTED');
      setAddress(res.address);
      onConnect?.(res.address);
      setIsOpen(false);
    } catch (err) {
      console.error('Wallet connect error:', err);
    }
  };

  const handleDisconnect = async () => {
    await masterWalletProvider.disconnect();
    setState('DISCONNECTED');
    setAddress(null);
    onDisconnect?.();
    setIsOpen(false);
  };

  if (state === 'CONNECTED' && address) {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sentinel-800/80 border border-emerald-500/30 hover:border-emerald-400/50 transition font-mono text-xs text-white shadow-[0_0_15px_rgba(52,211,153,0.1)]"
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold">{shortAddr}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 p-2 rounded-2xl bg-sentinel-900 border border-white/10 shadow-2xl backdrop-blur-xl z-50 font-mono text-xs space-y-1">
            <div className="p-2 border-b border-white/5">
              <span className="text-2xs text-slate-500 block uppercase">Connected Wallet</span>
              <p className="font-bold text-white truncate text-2xs">{address}</p>
            </div>

            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition text-left"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="sm"
        className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-mono text-xs font-bold gap-2 px-4 shadow-[0_0_20px_rgba(56,189,248,0.2)] rounded-xl"
      >
        <Wallet className="h-3.5 w-3.5" />
        <span>Connect Wallet</span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 p-3 rounded-2xl bg-sentinel-900 border border-white/10 shadow-2xl backdrop-blur-xl z-50 font-mono text-xs space-y-2">
          <span className="text-2xs text-slate-400 uppercase font-bold tracking-wider block px-1">
            Select Wallet Network
          </span>

          <button
            onClick={() => handleConnect('solana')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-sky-500/10 border border-white/5 hover:border-sky-500/30 transition text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center font-bold text-purple-300 text-2xs">
                SOL
              </div>
              <div>
                <p className="font-bold text-white group-hover:text-sky-300">Solana Wallet</p>
                <p className="text-2xs text-slate-500">Phantom, Solflare, Backpack</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleConnect('evm')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-sky-500/10 border border-white/5 hover:border-sky-500/30 transition text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 text-2xs">
                EVM
              </div>
              <div>
                <p className="font-bold text-white group-hover:text-sky-300">EVM Wallet</p>
                <p className="text-2xs text-slate-500">Base, Ethereum, Arbitrum</p>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
