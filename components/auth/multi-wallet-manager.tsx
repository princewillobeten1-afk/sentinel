'use client';

import React, { useState } from 'react';
import { useAuth } from './auth-provider';
import { WalletConnectModal } from './wallet-connect-modal';

export function MultiWalletManager() {
  const { wallets, disconnectWallet, setDefaultWallet } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleDisconnect = async (walletId: string) => {
    setLoadingAction(`dc_${walletId}`);
    try {
      await disconnectWallet(walletId);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSetDefault = async (walletId: string) => {
    setLoadingAction(`def_${walletId}`);
    try {
      await setDefaultWallet(walletId);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-2xl bg-[#0d131f] border border-cyan-900/40 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Linked Wallets</h2>
          <p className="text-xs text-cyan-200/60 mt-0.5">Manage multi-chain verified trading addresses</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Connect New Wallet</span>
        </button>
      </div>

      {wallets.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No wallets linked yet. Connect a wallet to prove cryptographic ownership.
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800/80"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                    {w.chainId}
                  </span>
                  <span className="text-sm font-semibold text-white font-mono">
                    {w.address.substring(0, 8)}...{w.address.slice(-6)}
                  </span>
                  {w.isPrimary && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-2xs font-bold border border-emerald-500/30">
                      DEFAULT
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Label: {w.label || 'Unnamed Wallet'}
                </p>
                <p className="text-2xs text-slate-500">
                  Status: <span className="text-cyan-400 capitalize">{w.status}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!w.isPrimary && (
                  <button
                    onClick={() => handleSetDefault(w.id)}
                    disabled={loadingAction === `def_${w.id}`}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs transition-all border border-slate-700"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleDisconnect(w.id)}
                  disabled={loadingAction === `dc_${w.id}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-400 text-xs transition-all border border-slate-700 hover:border-red-500/40"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <WalletConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
