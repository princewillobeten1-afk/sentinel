'use client';

import React, { useState } from 'react';
import {
  Wallet,
  CheckCircle2,
  Plus,
  Star,
  Trash2,
  Edit2,
  Copy,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  QrCode,
  Send,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useWalletState, useWalletActions, useNotificationsActions } from '@/lib/store';
import { WalletProviderId, LinkedWallet } from '@/lib/wallet/types';
import { WalletReceiveModal } from './wallet-receive-modal';
import { WalletSendModal } from './wallet-send-modal';

export function WalletManagementView() {
  const { linkedWallets, primaryWallet, authenticatedIdentity, sessionToken, status } = useWalletState();
  const {
    linkSecondaryWallet,
    setPrimaryWallet,
    updateWalletLabel,
    unlinkWallet,
    setWalletModalOpen,
  } = useWalletActions();
  const { addNotification } = useNotificationsActions();

  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState('');
  const [receiveWallet, setReceiveWallet] = useState<LinkedWallet | null>(null);
  const [sendWallet, setSendWallet] = useState<LinkedWallet | null>(null);

  const handleStartRename = (walletId: string, currentLabel: string) => {
    setEditingWalletId(walletId);
    setEditLabelText(currentLabel);
  };

  const handleSaveRename = async (walletId: string) => {
    if (!editLabelText.trim()) return;
    await updateWalletLabel(walletId, editLabelText.trim());
    setEditingWalletId(null);
    addNotification({
      title: 'Wallet Renamed',
      message: `Wallet label updated to "${editLabelText.trim()}".`,
      type: 'system',
    });
  };

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    addNotification({
      title: 'Address Copied',
      message: 'Full Solana address copied to clipboard.',
      type: 'system',
    });
  };

  const totalBalance = linkedWallets.reduce((acc, w) => acc + w.balanceSol, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel variant="subtle" className="space-y-1">
          <p className="text-xs text-slate-400">Linked wallets</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold font-numeric text-white">{linkedWallets.length} Wallets</span>
          </div>
        </Panel>

        <Panel variant="subtle" className="space-y-1">
          <p className="text-xs text-slate-400">Total SOL balance</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold font-numeric text-emerald-400">
              {totalBalance.toFixed(2)} SOL
            </span>
          </div>
        </Panel>

        <Panel variant="subtle" className="space-y-1">
          <p className="text-xs text-slate-400">Account session</p>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <span className="text-sm font-medium text-slate-200">{status === 'authenticated' ? 'Signed in' : 'Not signed in'}</span>
            <Badge variant={status === 'authenticated' ? 'success' : 'neutral'}>{status === 'authenticated' ? 'Authenticated' : 'Guest'}</Badge>
          </div>
        </Panel>
      </div>

      {/* Main Wallets Table Panel */}
      <Panel
        variant="default"
        title="Connected Wallet Accounts"
        subtitle="Manage primary trading keys and linked secondary wallets"
        headerActions={
          <Button
            onClick={() => setWalletModalOpen(true)}
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {linkedWallets.length ? 'Link wallet' : 'Connect wallet'}
          </Button>
        }
      >
        <div className="space-y-3">
          {linkedWallets.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No wallets connected. Connect a wallet to view balances and manage accounts.</p>}
          {linkedWallets.map((w) => {
            const isEditing = editingWalletId === w.id;

            return (
              <div
                key={w.id}
                className={`rounded-xl border p-4 transition ${
                  w.isPrimary
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : 'border-sentinel-800 bg-sentinel-900/60 hover:border-sentinel-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Wallet Details */}
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sentinel-800 text-sky-400 border border-sentinel-700">
                      <Wallet className="h-5 w-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editLabelText}
                              onChange={(e) => setEditLabelText(e.target.value)}
                              className="h-7 text-xs w-48 font-semibold"
                            />
                            <Button size="xs" variant="primary" onClick={() => handleSaveRename(w.id)}>
                              Save
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => setEditingWalletId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-bold text-slate-100">{w.label}</span>
                            <button
                              onClick={() => handleStartRename(w.id, w.label)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Rename Wallet"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {w.isPrimary && <Badge variant="success">Primary Wallet</Badge>}
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
                        <span>{w.address}</span>
                        <button
                          onClick={() => handleCopy(w.address)}
                          className="hover:text-sky-300 transition"
                          title="Copy Address"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <a
                          href={`https://solscan.io/account/${w.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-sky-300 transition flex items-center gap-0.5"
                        >
                          Solscan <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions & Balance */}
                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-sentinel-800">
                    <div className="text-left md:text-right">
                      <p className="text-2xs uppercase text-slate-500 font-mono">Available SOL</p>
                      <p className="text-base font-numeric font-bold text-emerald-400">
                        {w.balanceSol.toFixed(2)} SOL
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setReceiveWallet(w)}
                        variant="outline"
                        size="xs"
                        leftIcon={<QrCode className="h-3.5 w-3.5 text-sky-400" />}
                      >
                        Receive
                      </Button>

                      <Button
                        onClick={() => setSendWallet(w)}
                        variant="outline"
                        size="xs"
                        leftIcon={<Send className="h-3.5 w-3.5 text-sky-400" />}
                      >
                        Send
                      </Button>

                      {!w.isPrimary && (
                        <Button
                          onClick={() => setPrimaryWallet(w.id)}
                          variant="outline"
                          size="xs"
                          leftIcon={<Star className="h-3.5 w-3.5 text-amber-400" />}
                        >
                          Set Primary
                        </Button>
                      )}

                      {linkedWallets.length > 1 && (
                        <Button
                          onClick={() => unlinkWallet(w.id)}
                          variant="ghost"
                          size="xs"
                          className="text-rose-400 hover:bg-rose-950/40"
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          Unlink
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {receiveWallet && (
        <WalletReceiveModal
          wallet={receiveWallet}
          isOpen={!!receiveWallet}
          onClose={() => setReceiveWallet(null)}
          onCopy={handleCopy}
        />
      )}

      {sendWallet && (
        <WalletSendModal
          wallet={sendWallet}
          isOpen={!!sendWallet}
          onClose={() => setSendWallet(null)}
        />
      )}
    </div>
  );
}
