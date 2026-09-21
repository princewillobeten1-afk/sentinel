'use client';

import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Key,
  LogOut,
  Settings,
  Wallet,
  Lock,
  Copy,
  ExternalLink,
  Sliders,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWalletState, useWalletActions, useUIActions, useNotificationsActions } from '@/lib/store';

export function UserProfilePopover({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { status, authenticatedIdentity, primaryWallet, linkedWallets } = useWalletState();
  const { setWalletModalOpen, disconnectWallet, deleteAccount } = useWalletActions();
  const { setActiveView } = useUIActions();
  const { addNotification } = useNotificationsActions();

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isAuth = status === 'authenticated';
  const displayName = authenticatedIdentity?.displayName || 'Guest User';
  const shortAddress = primaryWallet
    ? `${primaryWallet.address.slice(0, 4)}...${primaryWallet.address.slice(-4)}`
    : 'Not Connected';

  const handleCopyAddress = () => {
    if (!primaryWallet) return;
    navigator.clipboard.writeText(primaryWallet.address);
    addNotification({
      title: 'Address Copied',
      message: `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-6)} copied.`,
      type: 'system',
    });
  };

  const handleConfirmDeleteAccount = async () => {
    await deleteAccount();
    setShowConfirmDelete(false);
    addNotification({
      title: 'Account Closed',
      message: 'Sentinel user account deactivated.',
      type: 'system',
    });
  };

  return (
    <Popover
      align={align}
      trigger={
        <button aria-label="Account menu" className="flex items-center gap-2 rounded-md border border-sentinel-700 bg-sentinel-900 px-3 py-1.5 text-xs text-slate-200 hover:border-sentinel-600 transition-colors">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-500/20 text-sky-400 font-bold text-2xs border border-sky-500/40 font-mono">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden md:inline-block font-semibold text-slate-100">{displayName}</span>
            {isAuth ? (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-slate-500" />
            )}
          </div>
        </button>
      }
    >
      <div className="w-80 space-y-3.5 font-mono text-xs select-none p-1">
        {/* User Identity Header */}
        <div className="flex items-center gap-3 border-b border-sentinel-800 pb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-950/60 text-sky-300 font-bold border border-sky-500/40 text-base font-mono shadow-inner">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-slate-100 font-sans text-sm truncate">{displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant={isAuth ? 'success' : 'mono'} size="sm">
                {isAuth ? 'SIWS Verified' : 'Guest Mode'}
              </Badge>
              <span className="text-2xs text-slate-400 font-mono">
                {authenticatedIdentity?.role?.toUpperCase() || 'USER'}
              </span>
            </div>
          </div>
        </div>

        {/* Identity & Address Section */}
        <div className="space-y-2 text-2xs">
          <div className="flex items-center justify-between py-1 border-b border-sentinel-800/60">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-sky-400" /> Wallet Address:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sky-300 font-mono">{shortAddress}</span>
              {primaryWallet && (
                <button
                  onClick={handleCopyAddress}
                  className="text-slate-400 hover:text-white transition"
                  title="Copy Full Address"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {primaryWallet && (
            <div className="flex items-center justify-between py-1 border-b border-sentinel-800/60">
              <span className="text-slate-400">Available SOL Balance:</span>
              <span className="font-bold text-emerald-400 font-numeric">{primaryWallet.balanceSol.toFixed(2)} SOL</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1 border-b border-sentinel-800/60">
            <span className="text-slate-400">Linked Wallets:</span>
            <span className="font-bold text-slate-200 font-numeric">{linkedWallets.length} Connected</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Lock className="h-3 w-3 text-amber-400" /> Auto-Lock Security:
            </span>
            <span className="text-slate-300 font-numeric">30 mins</span>
          </div>
        </div>

        {/* User Menu Actions (Section 17) */}
        <div className="pt-2 border-t border-sentinel-800 space-y-1">
          {primaryWallet && (
            <Button
              onClick={() => window.open(`https://solscan.io/account/${primaryWallet.address}`, '_blank')}
              variant="ghost"
              size="xs"
              className="w-full justify-start text-slate-300 hover:bg-sentinel-800"
              leftIcon={<ExternalLink className="h-3.5 w-3.5 text-sky-400" />}
            >
              View Explorer (Solscan)
            </Button>
          )}

          <Button
            onClick={() => setWalletModalOpen(true)}
            variant="ghost"
            size="xs"
            className="w-full justify-start text-slate-300 hover:bg-sentinel-800"
            leftIcon={<Wallet className="h-3.5 w-3.5 text-emerald-400" />}
          >
            Manage Wallets
          </Button>

          <Button
            onClick={() => setActiveView('settings')}
            variant="ghost"
            size="xs"
            className="w-full justify-start text-slate-300 hover:bg-sentinel-800"
            leftIcon={<Sliders className="h-3.5 w-3.5 text-amber-400" />}
          >
            Account Preferences
          </Button>

          <Button
            onClick={() => setActiveView('settings')}
            variant="ghost"
            size="xs"
            className="w-full justify-start text-slate-300 hover:bg-sentinel-800"
            leftIcon={<ShieldCheck className="h-3.5 w-3.5 text-purple-400" />}
          >
            Security & Controls
          </Button>

          {isAuth ? (
            <Button
              onClick={disconnectWallet}
              variant="outline"
              size="xs"
              className="w-full justify-start text-rose-400 hover:bg-rose-950/30 mt-1"
              leftIcon={<LogOut className="h-3.5 w-3.5" />}
            >
              Disconnect & Logout
            </Button>
          ) : (
            <Button
              onClick={() => setWalletModalOpen(true)}
              variant="primary"
              size="xs"
              className="w-full justify-start"
              leftIcon={<Key className="h-3.5 w-3.5" />}
            >
              Connect Wallet
            </Button>
          )}
        </div>

        {/* Account Deletion Controlled Deactivation Workflow (Section 15) */}
        {isAuth && (
          <div className="pt-2 border-t border-sentinel-800">
            {showConfirmDelete ? (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 space-y-2 text-2xs">
                <p className="text-rose-300 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Deactivate Account?
                </p>
                <p className="text-slate-400 leading-snug">
                  Controlled deactivation closes active session. Historical audit records are preserved.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button size="xs" variant="ghost" onClick={() => setShowConfirmDelete(false)}>
                    Cancel
                  </Button>
                  <Button size="xs" variant="destructive" onClick={handleConfirmDeleteAccount}>
                    Confirm Deactivate
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="w-full text-left text-2xs text-slate-500 hover:text-rose-400 transition py-1 flex items-center gap-1.5"
              >
                <Trash2 className="h-3 w-3" /> Deactivate Account...
              </button>
            )}
          </div>
        )}
      </div>
    </Popover>
  );
}
