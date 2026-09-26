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
  Download,
  ArrowLeft,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useWalletState, useWalletActions, useNotificationsActions } from '@/lib/store';
import { WalletProviderId } from '@/lib/wallet/types';
import { INSTALL_URLS } from '@/lib/wallet/solana-adapter';
import { DepositTab } from '@/components/wallet/deposit-tab';
import { WithdrawTab } from '@/components/wallet/withdraw-tab';
import { WalletHistoryTab } from '@/components/wallet/wallet-history-tab';
import { WalletMark } from '@/components/wallet/wallet-mark';

const WALLET_CATALOG: Array<{ id: WalletProviderId; name: string; desc: string }> = [
  { id: 'phantom', name: 'Phantom Wallet', desc: 'Solana & Multi-Chain Standard' },
  { id: 'solflare', name: 'Solflare Wallet', desc: 'Solana Web3 & Hardware Compatible' },
  { id: 'backpack', name: 'Backpack Wallet', desc: 'xNFT & High-Performance Solana' },
  { id: 'okx', name: 'OKX Wallet', desc: 'Multi-Chain Web3 & DEX Trading' },
  { id: 'coinbase', name: 'Coinbase Wallet', desc: 'Coinbase Solana Web3 Extension' },
];

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
    isRefreshingBalance,
    lastBalanceRefreshedAt,
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
    refreshWalletBalance,
    checkExtensionAvailability,
  } = useWalletActions();

  const { addNotification } = useNotificationsActions();

  const [customAddressInput, setCustomAddressInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [installTargetWallet, setInstallTargetWallet] = useState<{
    id: WalletProviderId;
    name: string;
    desc: string;
  } | null>(null);
  const [isCheckingInstall, setIsCheckingInstall] = useState(false);

  const handleSelectAdapter = async (adapterId: WalletProviderId) => {
    resetAuthError();

    // Check if browser extension is installed
    const adapter = adapters.find((a) => a.id === adapterId);
    const isInstalled = adapter?.checkInstalled ? adapter.checkInstalled() : adapter?.installed;

    if (!isInstalled && adapterId !== 'embedded' && adapterId !== 'manual') {
      const meta = WALLET_CATALOG.find((w) => w.id === adapterId) || {
        id: adapterId,
        name: adapter?.name || adapterId,
        desc: 'Solana Wallet Extension',
      };
      setInstallTargetWallet(meta);
      return;
    }

    setInstallTargetWallet(null);
    await connectWallet(adapterId);
  };

  const handleRetryDetection = async () => {
    if (!installTargetWallet) return;
    setIsCheckingInstall(true);
    checkExtensionAvailability();

    setTimeout(async () => {
      setIsCheckingInstall(false);
      const adapter = adapters.find((a) => a.id === installTargetWallet.id);
      const isNowInstalled = adapter?.checkInstalled ? adapter.checkInstalled() : adapter?.installed;

      if (isNowInstalled) {
        addNotification({
          title: 'Wallet Extension Detected',
          message: `${installTargetWallet.name} was successfully detected! Connecting...`,
          type: 'system',
        });
        setInstallTargetWallet(null);
        await connectWallet(installTargetWallet.id);
      } else {
        addNotification({
          title: 'Extension Not Detected',
          message: `${installTargetWallet.name} is not active. Please ensure the extension is enabled in your browser, then retry.`,
          type: 'system',
        });
      }
    }, 700);
  };

  const handleConnectCustomAddress = async () => {
    const trimmed = customAddressInput.trim();
    if (!trimmed) return;
    resetAuthError();
    await connectWallet('manual', trimmed);
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
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
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

  const handleManualBalanceRefresh = async () => {
    if (primaryWallet?.address) {
      const bal = await refreshWalletBalance(primaryWallet.address);
      addNotification({
        title: 'Balance Synchronized',
        message: `Current on-chain balance: ${bal.toFixed(4)} SOL`,
        type: 'system',
      });
    }
  };

  const isSmartWallet = Boolean(
    primaryWallet && (primaryWallet.id.startsWith('w_smart_') || selectedAdapter?.id === 'embedded')
  );

  return (
    <Modal
      isOpen={isWalletModalOpen}
      onClose={() => {
        setInstallTargetWallet(null);
        setWalletModalOpen(false);
      }}
      title={
        <span className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-sky-400" />
          {status === 'authenticated'
            ? 'Wallet & Funds Management'
            : status === 'authenticating'
            ? 'Sign-In With Solana (SIWS)'
            : installTargetWallet
            ? `Install ${installTargetWallet.name}`
            : 'Connect Solana Wallet'}
        </span>
      }
      subtitle={
        status === 'authenticated'
          ? `Connected Wallet: ${primaryWallet ? `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-6)}` : 'Active'}`
          : installTargetWallet
          ? `Browser extension required to connect ${installTargetWallet.name}`
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
        <div className="py-12 space-y-4 text-center">
          <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-ping" />
            <RefreshCw className="h-10 w-10 text-sky-400 animate-spin relative z-10 drop-shadow-[0_0_16px_rgba(56,189,248,0.6)]" />
          </div>
          <h4 className="text-base font-bold text-slate-100">Connecting to {selectedAdapter?.name || 'Wallet'}...</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Please approve the connection popup in your wallet extension to establish a secure link.
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
                <strong className="text-amber-300">Security Guarantee:</strong> This off-chain message proves wallet ownership ONLY. Zero gas fees. Does NOT authorize any blockchain transactions or token transfers.
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
              {/* Wallet Header & Live Balance Hero */}
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-sentinel-900/90 to-sentinel-950 p-5 space-y-4 shadow-[0_0_25px_rgba(16,185,129,0.12)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-bold text-slate-100">{primaryWallet.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" size="sm" className="font-mono text-2xs">
                      Connected & Active
                    </Badge>
                  </div>
                </div>

                {/* Solana Public Address Bar */}
                <div className="flex items-center justify-between bg-sentinel-950/95 p-3 rounded-xl border border-sentinel-800/80 shadow-inner">
                  <div className="overflow-hidden mr-2">
                    <p className="text-2xs uppercase tracking-wider text-slate-400 font-mono font-bold">Solana Address</p>
                    <p className="text-xs font-numeric font-bold text-sky-300 mt-0.5 font-mono truncate select-all">
                      {primaryWallet.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      onClick={() => handleCopyAddress(primaryWallet.address)}
                      variant="ghost"
                      size="xs"
                      className="text-slate-300 hover:text-white"
                      leftIcon={copiedAddress ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    >
                      {copiedAddress ? 'Copied' : 'Copy'}
                    </Button>
                    <a
                      href={`https://solscan.io/account/${primaryWallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-sentinel-800 transition"
                      title="View on Solscan"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Real-Time Live On-Chain Balance Card */}
                <div className="rounded-xl border border-sentinel-800/90 bg-sentinel-950/90 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xs uppercase tracking-wider text-slate-400 font-mono font-bold">
                        Available Balance
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live On-Chain
                      </span>
                    </div>

                    <button
                      onClick={handleManualBalanceRefresh}
                      disabled={isRefreshingBalance}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-mono text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-sky-500/30 transition disabled:opacity-50"
                      title="Fetch live balance from Solana RPC"
                    >
                      <RefreshCw className={`h-3 w-3 ${isRefreshingBalance ? 'animate-spin text-sky-300' : ''}`} />
                      <span>{isRefreshingBalance ? 'Querying...' : 'Sync'}</span>
                    </button>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-numeric font-extrabold text-emerald-400 text-2xl tracking-tight">
                        {primaryWallet.balanceSol.toFixed(4)}
                      </span>
                      <span className="text-sm font-bold text-emerald-500/80 font-mono">SOL</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        ≈ ${(primaryWallet.balanceSol * 145).toFixed(2)} USD
                      </span>
                      {lastBalanceRefreshedAt && (
                        <p className="text-3xs text-slate-400 font-mono mt-0.5">
                          Synced {new Date(lastBalanceRefreshedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Context-Aware Security Section */}
              {isSmartWallet ? (
                /* Sentinel Non-Custodial Smart Web Wallet Export Key */
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
              ) : (
                /* Browser Extension Custody Info */
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-slate-200">Extension-Managed Custody</p>
                    <p className="text-2xs text-slate-400 leading-relaxed">
                      Your private keys are securely encrypted inside your browser extension. Sentinel is 100% self-custodial and never has access to your private key or seed phrases.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveWalletTab('deposit')}
                    leftIcon={<ArrowDownToLine className="h-3.5 w-3.5 text-emerald-400" />}
                  >
                    Deposit SOL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveWalletTab('withdraw')}
                    leftIcon={<ArrowUpFromLine className="h-3.5 w-3.5 text-rose-400" />}
                  >
                    Withdraw
                  </Button>
                </div>
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
      ) : installTargetWallet ? (
        /* VIEW 4: Missing Wallet Download Guide Prompt */
        <div className="space-y-5 py-2">
          <button
            onClick={() => setInstallTargetWallet(null)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-mono"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Wallets
          </button>

          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-b from-sky-950/30 via-sentinel-900/90 to-sentinel-950 p-6 text-center space-y-4 shadow-[0_0_30px_rgba(56,189,248,0.1)]">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-sky-500/20 blur-md" />
              <WalletMark id={installTargetWallet.id} name={installTargetWallet.name} size={48} className="relative z-10" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white tracking-wide">
                {installTargetWallet.name} Not Detected
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                The {installTargetWallet.name} browser extension was not found in this browser. To trade on Sentinel using this wallet, install the official extension.
              </p>
            </div>

            <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/90 p-3.5 max-w-md mx-auto text-left space-y-2 text-2xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Official verified extension from {installTargetWallet.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>100% self-custodial — keys stay encrypted on your device</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Instant trading & low-latency execution on Sentinel</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href={INSTALL_URLS[installTargetWallet.id] || 'https://phantom.app/download'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.4)] transition"
              >
                <Download className="h-4 w-4" />
                Download {installTargetWallet.name} ↗
              </a>

              <Button
                variant="outline"
                size="md"
                onClick={handleRetryDetection}
                disabled={isCheckingInstall}
                leftIcon={<RefreshCw className={`h-4 w-4 ${isCheckingInstall ? 'animate-spin text-sky-400' : ''}`} />}
              >
                {isCheckingInstall ? 'Checking Browser...' : "Check Again / I've Installed It"}
              </Button>
            </div>
          </div>

          {/* Alternative 1-click option */}
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-sky-400" />
              <span className="text-slate-300">Don't want to install an extension?</span>
            </div>
            <button
              onClick={() => {
                setInstallTargetWallet(null);
                fastConnectSmartWallet();
              }}
              className="text-sky-400 hover:text-sky-300 font-bold font-mono transition"
            >
              Use 1-Click Smart Wallet ⚡
            </button>
          </div>
        </div>
      ) : (
        /* VIEW 5: Unauthenticated Connect Options */
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
              {WALLET_CATALOG.map((w) => {
                const adapter = adapters.find((a) => a.id === w.id);
                const isInstalled = adapter?.checkInstalled ? adapter.checkInstalled() : adapter?.installed;

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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Detected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 group-hover:border-sky-500/40">
                        <Download className="h-3 w-3" /> Install
                      </span>
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
