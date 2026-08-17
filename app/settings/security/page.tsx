'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { MultiWalletManager } from '@/components/auth/multi-wallet-manager';
import { SessionManager } from '@/components/auth/session-manager';

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    setPwError(null);

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long');
      return;
    }

    setPwLoading(true);

    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || data.message || 'Failed to update password');
      }

      setPwMessage('Password successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Password update failed');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070b14] text-white p-6 max-w-5xl mx-auto space-y-8 pb-20">
      <div>
        <div className="inline-flex items-center gap-2 text-cyan-400 font-semibold text-xs tracking-wider uppercase mb-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          Identity & Security Center
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Security & Wallet Settings</h1>
        <p className="text-xs text-cyan-200/60 mt-1">
          Manage your verified multi-chain wallets, credentials, and active device sessions.
        </p>
      </div>

      {/* Multi-Wallet Manager */}
      <MultiWalletManager />

      {/* Session Manager */}
      <SessionManager />

      {/* Password Change Card */}
      <div className="rounded-2xl bg-[#0d131f] border border-cyan-900/40 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white">Change Password</h2>
          <p className="text-xs text-cyan-200/60 mt-0.5">
            Update your account password to rotate server credentials
          </p>
        </div>

        {pwMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{pwMessage}</span>
          </div>
        )}

        {pwError && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{pwError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-cyan-300/80 mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-cyan-300/80 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-cyan-300/80 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs transition-all border border-slate-700 disabled:opacity-50"
          >
            {pwLoading ? 'Updating Password...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Danger Zone: Account Deactivation */}
      <div className="rounded-2xl bg-red-950/20 border border-red-900/40 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-red-400">Danger Zone</h2>
          <p className="text-xs text-red-200/60 mt-0.5">
            Permanently close your account and revoke all authenticated sessions.
          </p>
        </div>
        <button
          onClick={async () => {
            if (confirm('Are you sure you want to deactivate your account? All active sessions will be terminated.')) {
              const res = await fetch('/api/v1/users/me', { method: 'DELETE', credentials: 'include' });
              if (res.ok) {
                window.location.href = '/login';
              }
            }
          }}
          className="px-4 py-2.5 rounded-xl bg-red-900/40 hover:bg-red-800/60 border border-red-500/50 text-red-200 text-xs font-bold transition-all"
        >
          Deactivate Account
        </button>
      </div>
    </main>
  );
}
