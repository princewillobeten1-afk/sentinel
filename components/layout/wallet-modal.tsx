'use client';

import React from 'react';
import {
  Wallet,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  Copy,
  Plus,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Star,
  Trash2,
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Coins,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWalletState, useWalletActions, useNotificationsActions } from '@/lib/store';
import { WalletProviderId } from '@/lib/wallet/types';
import { DepositTab } from '@/components/wallet/deposit-tab';
import { WithdrawTab } from '@/components/wallet/withdraw-tab';
import { WalletHistoryTab } from '@/components/wallet/wallet-history-tab';

export function WalletModal() {
  const {
    isWalletModalOpen,
    status,
    adapters,
    selectedAdapter,
    activePublicKey,
    activeChallenge,
    authenticatedIdentity,
    linkedWallets,
    primaryWallet,
    authError,
    activeWalletTab,
  } = useWalletState();

  const {
    setWalletModalOpen,
    setActiveWalletTab,
    connectWallet,
    authenticateSIWS,
    linkSecondaryWallet,
    setPrimaryWallet,
    updateWalletLabel,
    unlinkWallet,
    disconnectWallet,
    resetAuthError,
  } = useWalletActions();

  const { addNotification } = useNotificationsActions();

  const handleSelectAdapter = async (adapterId: WalletProviderId) => {
    resetAuthError();
    await connectWallet(adapterId);
  };

  const handleAuthenticate = async () => {
    await authenticateSIWS();
    if (status === 'authenticated') {
      addNotification({
        title: 'Authentication Successful',
        message: 'Sign-In With Solana (SIWS) session established.',
        type: 'system',
      });
    }
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    addNotification({
      title: 'Address Copied',
      message: `${addr.slice(0, 6)}...${addr.slice(-6)} copied to clipboard.`,
      type: 'system',
    });
  };

  return (
    <Modal
      isOpen={isWalletModalOpen}
      onClose={() => setWalletModalOpen(false)}
      title={
        <span className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-sky-400" />
          {status === 'authenticated'
            ? 'Wallet & Funds Management'
            : status === 'authenticating'
            ? 'Sign-In With Solana (SIWS)'
            : 'Connect Solana Wallet'}
        </span>
      }
      subtitle={
        status === 'authenticated'
          ? `Authenticated User: ${authenticatedIdentity?.displayName || 'Sentinel User'}`
          : 'Solana Mainnet-Beta account authentication'
      }
      size="lg"
    >
      {authError && (
        <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/20 p-3.5 flex items-start justify-between text-xs text-rose-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
          <button onClick={resetAuthError} className="text-slate-400 hover:text-white transition">
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: Connecting / Signing / SIWS Signature Challenge View */}
      {status === 'connecting' ? (
        <div className="py-8 space-y-4 text-center">
          <RefreshCw className="h-8 w-8 text-sky-400 animate-spin mx-auto" />
          <h4 className="text-sm font-bold text-slate-100">Connecting to {selectedAdapter?.name || 'Wallet'}...</h4>
          <p className="text-xs text-slate-400">Please approve the connection request in your wallet extension.</p>
        </div>
      ) : status === 'authenticating' && activeChallenge ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs uppercase tracking-wider font-mono">
                <Lock className="h-4 w-4" /> Off-Chain Authentication Signature Only
              </div>
              <Badge variant="warning" size="sm">Sign Message in Wallet</Badge>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sign the message in your wallet to verify ownership of public key{' '}
              <span className="font-mono text-sky-300 font-bold">
                {activePublicKey ? `${activePublicKey.slice(0, 6)}...${activePublicKey.slice(-6)}` : ''}
              </span>
              .
            </p>
            <div className="rounded-lg bg-sentinel-950/80 p-2.5 border border-amber-500/30 flex items-start gap-2 text-2xs text-amber-200">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-amber-300">Security Guarantee:</strong> This off-chain message proves wallet ownership ONLY. Zero gas fees. Does NOT authorize any blockchain transactions, token approvals, or asset transfers.
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-4 space-y-2">
            <div className="flex items-center justify-between text-2xs font-mono text-slate-400">
              <span>DOMAIN: {activeChallenge.domain}</span>
              <span>NETWORK: Solana Mainnet</span>
            </div>
            <pre className="text-2xs font-mono text-slate-300 bg-sentinel-900/90 p-3 rounded-lg border border-sentinel-800 overflow-x-auto whitespace-pre-wrap leading-tight">
              {activeChallenge.formattedMessage}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => connectWallet(selectedAdapter?.id || 'embedded')}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-request Challenge
            </Button>
            <Button variant="buy" size="md" onClick={handleAuthenticate} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
              Sign & Verify Wallet
            </Button>
          </div>
        </div>
      ) : status === 'authenticated' && primaryWallet ? (
        /* VIEW 2: Authenticated Tabbed Dashboard */
        <div className="space-y-4">
          {/* Navigation Tab Header */}
          <div className="flex items-center gap-1 border-b border-sentinel-800 pb-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveWalletTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                activeWalletTab === 'overview'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Coins className="h-3.5 w-3.5" /> Overview
            </button>
            <button
              onClick={() => setActiveWalletTab('deposit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                activeWalletTab === 'deposit'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-400" /> Deposit
            </button>
            <button
              onClick={() => setActiveWalletTab('withdraw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                activeWalletTab === 'withdraw'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpFromLine className="h-3.5 w-3.5 text-rose-400" /> Withdraw
            </button>
            <button
              onClick={() => setActiveWalletTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                activeWalletTab === 'history'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5" /> History
            </button>
            <button
              onClick={() => setActiveWalletTab('wallets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition shrink-0 ${
                activeWalletTab === 'wallets'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" /> Wallets ({linkedWallets.length})
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeWalletTab === 'overview' && (
            <div className="space-y-4">
              {/* Primary Wallet Card */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-bold text-slate-100">{primaryWallet.label}</span>
                  </div>
                  <Badge variant="success" size="sm">Primary Wallet</Badge>
                </div>

                <div className="flex items-center justify-between bg-sentinel-950/90 p-3 rounded-lg border border-sentinel-800">
                  <div>
                    <p className="text-2xs uppercase text-slate-500 font-mono">Solana Address</p>
                    <p className="text-xs font-numeric font-bold text-sky-300 mt-0.5 font-mono">
                      {primaryWallet.address}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleCopyAddress(primaryWallet.address)}
                    variant="ghost"
                    size="xs"
                    leftIcon={<Copy className="h-3.5 w-3.5" />}
                  >
                    Copy
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 font-medium">Verified SOL Balance:</span>
                  <span className="font-numeric font-bold text-emerald-400 text-lg">
                    {primaryWallet.balanceSol.toFixed(4)} SOL
                  </span>
                </div>
              </div>

              {/* Quick Action Deposit & Withdraw Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveWalletTab('deposit')}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/40 hover:border-emerald-400 text-emerald-300 transition text-xs font-bold font-mono group"
                >
                  <ArrowDownToLine className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                  Deposit Crypto
                </button>
                <button
                  onClick={() => setActiveWalletTab('withdraw')}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/30 hover:bg-rose-900/40 hover:border-rose-400 text-rose-300 transition text-xs font-bold font-mono group"
                >
                  <ArrowUpFromLine className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
                  Withdraw Crypto
                </button>
              </div>

              <div className="rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-3.5 space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-sky-300 font-semibold">
                  <ShieldCheck className="h-4 w-4" /> Session & Key Security
                </div>
                <p className="leading-relaxed text-2xs text-slate-400">
                  Session auto-lock active (30 minutes). Private keys remain strictly isolated within your wallet extension.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                  onClick={() => window.open(`https://solscan.io/account/${primaryWallet.address}`, '_blank')}
                >
                  View on Solscan
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  leftIcon={<LogOut className="h-3.5 w-3.5" />}
                  onClick={disconnectWallet}
                >
                  Disconnect All
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: DEPOSIT */}
          {activeWalletTab === 'deposit' && <DepositTab />}

          {/* TAB 3: WITHDRAW */}
          {activeWalletTab === 'withdraw' && <WithdrawTab />}

          {/* TAB 4: HISTORY */}
          {activeWalletTab === 'history' && <WalletHistoryTab />}

          {/* TAB 5: LINKED WALLETS */}
          {activeWalletTab === 'wallets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                  Linked Identity Wallets ({linkedWallets.length})
                </h4>
                <Button
                  variant="outline"
                  size="xs"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => linkSecondaryWallet('solflare')}
                >
                  Link Secondary Wallet
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                {linkedWallets.map((w) => (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between rounded-xl border p-3 transition ${
                      w.isPrimary
                        ? 'border-sky-500/40 bg-sky-950/20'
                        : 'border-sentinel-800 bg-sentinel-900/60 hover:border-sentinel-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sentinel-800 text-sky-400">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">{w.label}</span>
                          {w.isPrimary && <Badge variant="info" size="sm">Primary</Badge>}
                        </div>
                        <p className="text-2xs font-mono text-slate-400">
                          {w.address.slice(0, 6)}...{w.address.slice(-6)} • {w.balanceSol.toFixed(4)} SOL
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!w.isPrimary && (
                        <Button
                          onClick={() => setPrimaryWallet(w.id)}
                          variant="ghost"
                          size="xs"
                          leftIcon={<Star className="h-3 w-3 text-amber-400" />}
                        >
                          Make Primary
                        </Button>
                      )}
                      {linkedWallets.length > 1 && (
                        <button
                          onClick={() => unlinkWallet(w.id)}
                          className="rounded p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                          title="Unlink Wallet"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 3: Wallet Provider Selection View */
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Select your preferred Solana wallet extension or test with Sentinel’s embedded keypair.
          </p>

          <div className="space-y-2">
            {adapters.map((adapter) => (
              <button
                key={adapter.id}
                onClick={() => handleSelectAdapter(adapter.id)}
                className="w-full flex items-center justify-between rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-3.5 hover:border-sentinel-500 hover:bg-sentinel-800 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{adapter.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-sky-300 transition-colors">
                      {adapter.name}
                    </p>
                    <p className="text-xs text-slate-400">{adapter.type} adapter</p>
                  </div>
                </div>
                <Badge variant={adapter.installed ? 'success' : 'mono'} size="sm">
                  {adapter.installed ? 'Detected' : 'Supported'}
                </Badge>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 flex items-center gap-2.5 text-2xs text-slate-400">
            <KeyRound className="h-4 w-4 text-sky-400 shrink-0" />
            <span>Sentinel uses off-chain SIWS signature proofs. We never ask for seed phrases.</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
