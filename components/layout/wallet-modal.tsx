'use client';

import React, { useState } from 'react';
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
  Key,
  Eye,
  EyeOff,
  Search,
  Sparkles,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useWalletState, useWalletActions, useNotificationsActions } from '@/lib/store';
import { WalletProviderId } from '@/lib/wallet/types';
import { DepositTab } from '@/components/wallet/deposit-tab';
import { WithdrawTab } from '@/components/wallet/withdraw-tab';
import { WalletHistoryTab } from '@/components/wallet/wallet-history-tab';
import { WalletMark } from '@/components/wallet/wallet-mark';

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
    fastConnectSmartWallet,
    authenticateSIWS,
    exportSmartWalletPrivateKey,
    linkSecondaryWallet,
    setPrimaryWallet,
    updateWalletLabel,
    unlinkWallet,
    disconnectWallet,
    resetAuthError,
  } = useWalletActions();

  const { addNotification } = useNotificationsActions();

  const [customAddressInput, setCustomAddressInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [exportedKey, setExportedKey] = useState<string | null>(null);

  const handleSelectAdapter = async (adapterId: WalletProviderId) => {
    resetAuthError();
    await connectWallet(adapterId);
  };

  const handleConnectCustomAddress = async () => {
    if (!customAddressInput.trim()) return;
    resetAuthError();
    await connectWallet('manual', customAddressInput.trim());
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

  const handleExportKey = () => {
    const key = exportSmartWalletPrivateKey();
    if (key) {
      setExportedKey(key);
      setShowPrivateKey(true);
    }
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
          ? `Connected Wallet: ${primaryWallet ? `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-6)}` : 'Active'}`
          : 'Connect your Solana wallet or generate an instant non-custodial Smart Wallet'
      }
      size="lg"
    >
      {authError && (
        <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 flex items-start justify-between text-xs text-rose-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
          <button onClick={resetAuthError} className="text-slate-400 hover:text-white transition">
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: Connecting Status */}
      {status === 'connecting' ? (
        <div className="py-10 space-y-4 text-center">
          <RefreshCw className="h-10 w-10 text-sky-400 animate-spin mx-auto drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]" />
          <h4 className="text-base font-bold text-slate-100">Connecting to {selectedAdapter?.name || 'Wallet'}...</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Please approve the connection popup in your wallet extension.
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                disconnectWallet();
                resetAuthError();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : status === 'authenticating' && activeChallenge ? (
        /* VIEW 2: SIWS Signature Challenge View */
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs uppercase tracking-wider font-mono">
                <Lock className="h-4 w-4" /> Off-Chain Authentication Signature Only
              </div>
              <Badge variant="warning" size="sm">Action Required</Badge>
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
                <strong className="text-amber-300">Security Guarantee:</strong> This off-chain message proves wallet ownership ONLY. Zero gas fees. Does NOT authorize any blockchain transactions or token approvals.
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-2xs font-mono text-slate-400">
              <span>DOMAIN: {activeChallenge.domain}</span>
              <span>NETWORK: Solana Mainnet</span>
            </div>
            <pre className="text-2xs font-mono text-slate-300 bg-sentinel-900/90 p-3 rounded-lg border border-sentinel-800 overflow-x-auto whitespace-pre-wrap leading-tight max-h-32">
              {activeChallenge.formattedMessage}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAuthenticate()}
            >
              Skip & Fast Connect
            </Button>
            <Button
              variant="buy"
              size="md"
              onClick={handleAuthenticate}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Sign & Verify Wallet
            </Button>
          </div>
        </div>
      ) : status === 'authenticated' && primaryWallet ? (
        /* VIEW 3: Authenticated Tabbed Dashboard */
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
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-bold text-slate-100">{primaryWallet.label}</span>
                  </div>
                  <Badge variant="success" size="sm">Connected & Active</Badge>
                </div>

                <div className="flex items-center justify-between bg-sentinel-950/90 p-3 rounded-lg border border-sentinel-800">
                  <div className="overflow-hidden mr-2">
                    <p className="text-2xs uppercase text-slate-500 font-mono">Solana Address</p>
                    <p className="text-xs font-numeric font-bold text-sky-300 mt-0.5 font-mono truncate">
                      {primaryWallet.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      onClick={() => handleCopyAddress(primaryWallet.address)}
                      variant="ghost"
                      size="xs"
                      leftIcon={<Copy className="h-3.5 w-3.5" />}
                    >
                      Copy
                    </Button>
                    <a
                      href={`https://solscan.io/account/${primaryWallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-sentinel-800 transition"
                      title="View on Solscan"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 font-medium">Available Balance:</span>
                  <span className="font-numeric font-bold text-emerald-400 text-lg">
                    {primaryWallet.balanceSol.toFixed(4)} SOL
                  </span>
                </div>
              </div>

              {/* Smart Wallet Export Key Section */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <Key className="h-3.5 w-3.5 text-sky-400" />
                    <span>Non-Custodial Key Security</span>
                  </div>
                  <Button
                    onClick={handleExportKey}
                    variant="outline"
                    size="xs"
                    leftIcon={showPrivateKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  >
                    {showPrivateKey ? 'Hide Key' : 'Export Private Key'}
                  </Button>
                </div>

                {showPrivateKey && exportedKey && (
                  <div className="space-y-2 pt-1 border-t border-sentinel-800">
                    <p className="text-2xs text-amber-300 font-mono">
                      ⚠️ Never share this private key. Anyone with it has full custody of this wallet.
                    </p>
                    <div className="flex items-center gap-2 bg-sentinel-900 p-2 rounded border border-sentinel-700">
                      <input
                        type="password"
                        readOnly
                        value={exportedKey}
                        className="bg-transparent font-mono text-2xs text-sky-300 w-full outline-none"
                      />
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleCopyAddress(exportedKey)}
                        leftIcon={<Copy className="h-3 w-3" />}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveWalletTab('deposit')}
                  leftIcon={<ArrowDownToLine className="h-3.5 w-3.5 text-emerald-400" />}
                >
                  Deposit SOL
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectWallet()}
                  leftIcon={<LogOut className="h-3.5 w-3.5" />}
                >
                  Disconnect Wallet
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Linked Solana Wallets</span>
                <Button
                  onClick={() => linkSecondaryWallet('phantom')}
                  variant="outline"
                  size="xs"
                  leftIcon={<Plus className="h-3 w-3" />}
                >
                  Link Another Wallet
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                {linkedWallets.map((w) => (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      w.isPrimary
                        ? 'border-emerald-500/40 bg-emerald-950/20'
                        : 'border-sentinel-800 bg-sentinel-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sentinel-800 text-sky-400">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">{w.label}</span>
                          {w.isPrimary && <Badge variant="success" size="sm">Primary</Badge>}
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
                          Set Primary
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
        /* VIEW 4: Unauthenticated Connect Options */
        <div className="space-y-4">
          {/* Quick Connect Hero Option: Sentinel Smart Wallet */}
          <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-950/40 via-sentinel-900/90 to-indigo-950/40 p-4 space-y-3 shadow-[0_0_20px_rgba(56,189,248,0.15)] relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 font-bold text-xs border border-sky-500/30">
                    ⚡
                  </span>
                  <span className="text-sm font-bold text-white tracking-wide">Sentinel Smart Wallet</span>
                  <Badge variant="info" size="sm">Recommended</Badge>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  1-Click non-custodial web wallet. Instant trading & zero extension required. Full exportable keys.
                </p>
              </div>
            </div>

            <Button
              onClick={fastConnectSmartWallet}
              variant="buy"
              size="md"
              className="w-full font-bold shadow-glow text-xs"
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              1-Click Connect Smart Wallet
            </Button>
          </div>

          {/* Browser Extension Wallets */}
          <div className="space-y-2">
            <p className="text-2xs uppercase tracking-wider font-mono text-slate-400 font-bold px-1">
              Browser Extension Wallets
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'phantom' as WalletProviderId, name: 'Phantom Wallet', desc: 'Solana & Multi-Chain' },
                { id: 'solflare' as WalletProviderId, name: 'Solflare Wallet', desc: 'Solana Web3' },
                { id: 'backpack' as WalletProviderId, name: 'Backpack Wallet', desc: 'xNFT & Solana' },
                { id: 'okx' as WalletProviderId, name: 'OKX Wallet', desc: 'Web3 & DEX Trading' },
              ].map((w) => {
                const adapter = adapters.find((a) => a.id === w.id);
                const isInstalled = adapter?.installed;

                return (
                  <button
                    key={w.id}
                    onClick={() => handleSelectAdapter(w.id)}
                    className="flex items-center justify-between p-3 rounded-xl border border-sentinel-800 bg-sentinel-900/70 hover:border-sky-500/50 hover:bg-sentinel-850 transition text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <WalletMark id={w.id} name={w.name} size={28} />
                      <div>
                        <p className="text-xs font-bold text-slate-100 group-hover:text-sky-300 transition-colors">
                          {w.name}
                        </p>
                        <p className="text-2xs text-slate-400">{w.desc}</p>
                      </div>
                    </div>
                    {isInstalled ? (
                      <Badge variant="success" size="sm">Detected</Badge>
                    ) : (
                      <span className="text-2xs font-mono text-sky-400 group-hover:underline">Connect</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom / Watch Solana Address Section */}
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-200">Connect Custom Solana Address</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Paste any Solana address (e.g. 7xK9...3a19)"
                value={customAddressInput}
                onChange={(e) => setCustomAddressInput(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectCustomAddress}
                disabled={!customAddressInput.trim()}
                className="shrink-0"
              >
                Connect Address
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 flex items-center gap-2.5 text-2xs text-slate-400">
            <KeyRound className="h-4 w-4 text-sky-400 shrink-0" />
            <span>Sentinel is 100% self-custodial. We never hold your private keys or seed phrases.</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
