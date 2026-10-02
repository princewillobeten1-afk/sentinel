'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrackedWalletCategory } from '@/lib/store/tracked-wallets-store';
import { Users, Shield, Bell, Check, AlertCircle } from 'lucide-react';

interface TrackWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrack: (data: {
    address: string;
    label: string;
    category: TrackedWalletCategory;
    notes?: string;
    minAlertTradeUsd?: number;
  }) => Promise<boolean>;
}

export function TrackWalletModal({ isOpen, onClose, onTrack }: TrackWalletModalProps) {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<TrackedWalletCategory>('SMART_MONEY');
  const [notes, setNotes] = useState('');
  const [minAlertUsd, setMinAlertUsd] = useState('500');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = address.trim();
    if (!clean) {
      setError('Please provide a Solana wallet address.');
      return;
    }

    if (clean.length < 32 || clean.length > 44) {
      setError('Invalid Solana address length (must be 32-44 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onTrack({
        address: clean,
        label: label.trim() || `Wallet ${clean.slice(0, 4)}...${clean.slice(-4)}`,
        category,
        notes: notes.trim(),
        minAlertTradeUsd: parseFloat(minAlertUsd) || 500,
      });

      if (success) {
        setAddress('');
        setLabel('');
        setNotes('');
        onClose();
      } else {
        setError('Failed to track wallet. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setAddress(text.trim());
    } catch {}
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2 text-white font-bold text-base">
          <Users className="h-5 w-5 text-sky-400" /> Track Smart Wallet
        </span>
      }
      subtitle="Monitor on-chain trades, win rate, and receive real-time alpha alerts"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">Solana Wallet Address *</label>
            <button
              type="button"
              onClick={handlePaste}
              className="text-2xs font-mono text-sky-400 hover:text-sky-300 underline"
            >
              Paste from clipboard
            </button>
          </div>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"
            className="font-mono text-xs bg-sentinel-950 border-sentinel-750 text-white"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Custom Nickname / Label</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 80% Winrate Caller"
              className="text-xs bg-sentinel-950 border-sentinel-750 text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Category Tag</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TrackedWalletCategory)}
              className="w-full h-10 px-3 rounded-md border border-sentinel-750 bg-sentinel-950 text-xs text-white focus:outline-none focus:border-sky-400 font-mono"
            >
              <option value="SMART_MONEY">Smart Money / Alpha</option>
              <option value="WHALE">Whale / Big Capital</option>
              <option value="KOL">KOL / Influencer</option>
              <option value="INSIDER">Probable Insider</option>
              <option value="SNIPER">Launch Sniper</option>
              <option value="DEV">Token Developer</option>
              <option value="GENERAL">General Watch</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Research Notes & Trade Thesis</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Good entry on memecoins under $500k mcap; sells in chunks."
            className="w-full p-2.5 rounded-md border border-sentinel-750 bg-sentinel-950 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 font-sans"
          />
        </div>

        <div className="p-3 rounded-lg bg-sentinel-900/60 border border-sentinel-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Alert Min Trade Size</p>
              <p className="text-2xs text-slate-400">Trigger live banner when wallet trades over this amount</p>
            </div>
          </div>
          <div className="w-24">
            <Input
              type="number"
              value={minAlertUsd}
              onChange={(e) => setMinAlertUsd(e.target.value)}
              className="text-xs text-right bg-black/60 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-sentinel-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            Start Tracking
          </Button>
        </div>
      </form>
    </Modal>
  );
}
