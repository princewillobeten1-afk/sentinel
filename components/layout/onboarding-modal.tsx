'use client';

import React, { useState } from 'react';
import { ShieldCheck, Zap, ArrowRight, CheckCircle2, Sliders, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWalletState, useWalletActions, usePreferencesState, usePreferencesActions, useUIActions } from '@/lib/store';

export function OnboardingModal() {
  const { status, primaryWallet, authenticatedIdentity } = useWalletState();
  const { setWalletModalOpen } = useWalletActions();
  const { preferences } = usePreferencesState();
  const { updatePreferences } = usePreferencesActions();
  const { setActiveView } = useUIActions();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isOpen, setIsOpen] = useState(false);

  // Trigger lightweight onboarding if user is newly authenticated
  const isAuth = status === 'authenticated';

  const handleCompleteOnboarding = () => {
    setIsOpen(false);
    setActiveView('dashboard');
  };

  if (!isOpen && !isAuth) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={
        <span className="flex items-center gap-2 text-sky-400">
          <Zap className="h-5 w-5 fill-current" /> Welcome to Project Sentinel
        </span>
      }
      subtitle="Fast-track Web3 onboarding & setup"
      size="md"
    >
      {step === 1 && (
        <div className="space-y-5 text-xs text-slate-300">
          <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-2">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-400" /> Web3 Market-Integrity Operating System
            </h4>
            <p className="leading-relaxed text-slate-400">
              Sentinel empowers traders with real-time token discovery, holder cluster analysis, insider risk alerts, and execution protection.
            </p>
          </div>

          <div className="space-y-2 font-mono text-2xs">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-sentinel-800 bg-sentinel-900/60">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Sign-In With Solana (SIWS) Cryptographic Session</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-sentinel-800 bg-sentinel-900/60">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Multi-Wallet Identity & Portfolio Aggregation</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-sentinel-800 bg-sentinel-900/60">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Personalized Trading Risk Rules & Slippage Safeguards</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="buy" size="md" onClick={() => setStep(2)} rightIcon={<ArrowRight className="h-4 w-4" />}>
              Configure Preferences
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 text-xs text-slate-300">
          <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            Quick Trading & Risk Preferences
          </h4>

          <div className="space-y-3 font-mono">
            <div>
              <p className="text-slate-400 mb-1.5">Default Slippage Tolerance:</p>
              <div className="grid grid-cols-4 gap-2">
                {[0.1, 0.5, 1.0, 3.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => updatePreferences({ slippageTolerance: val })}
                    className={`py-2 rounded-lg border text-center transition ${
                      preferences.slippageTolerance === val
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold'
                        : 'border-sentinel-800 bg-sentinel-900 text-slate-400'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-slate-400 mb-1.5">Risk Tolerance Profile:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'conservative', label: 'Conservative' },
                  { id: 'moderate', label: 'Moderate' },
                  { id: 'high', label: 'High Volatility' },
                  { id: 'degenerate', label: 'Degenerate' },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => updatePreferences({ riskLevel: r.id as any })}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      preferences.riskLevel === r.id
                        ? 'border-amber-500 bg-amber-950/30 text-amber-300 font-bold'
                        : 'border-sentinel-800 bg-sentinel-900 text-slate-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="buy" size="md" onClick={handleCompleteOnboarding} rightIcon={<ArrowRight className="h-4 w-4" />}>
              Enter Sentinel Dashboard
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
