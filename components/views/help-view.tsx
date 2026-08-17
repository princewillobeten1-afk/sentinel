'use client';

import React from 'react';
import { HelpCircle, Command, ShieldCheck, BookOpen, ExternalLink } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';

export function HelpView() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-sky-400" /> Sentinel Terminal Documentation & Help
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Guide to risk model explainability, keyboard navigation, and session keys.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Risk Model Principles" subtitle="Explainable evidence vs arbitrary scores">
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Sentinel provides supporting on-chain evidence, confidence intervals, and financial impact assessments for every flagged token rather than unexplained safety scores.
          </p>
        </Panel>

        <Panel title="Restricted Trading Sessions" subtitle="Session keys & MEV protection">
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Session keys allow high-frequency execution with auto-expiring spending limits without granting unrestricted wallet custody.
          </p>
        </Panel>
      </div>
    </div>
  );
}
