'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Clock,
  DollarSign,
  CheckCircle2,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminRole } from '@/lib/admin/types';

interface AdminAiQualityTabProps {
  currentRole: AdminRole;
}

export function AdminAiQualityTab({ currentRole }: AdminAiQualityTabProps) {
  const [primaryModel, setPrimaryModel] = useState('gemini-3.7-flash');
  const [fallbackModel, setFallbackModel] = useState('gemini-3.5-flash');
  const [groundingStrictness, setGroundingStrictness] = useState('STANDARD');

  return (
    <div className="space-y-6">
      {/* 1. Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">24h AI Requests</span>
          <p className="text-xl font-bold text-white font-mono">1,248,920</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Grounding Score</span>
          <p className="text-xl font-bold text-emerald-400 font-mono">98.7% Verified</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Avg Inference Latency</span>
          <p className="text-xl font-bold text-sky-400 font-mono">142ms (P99: 410ms)</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Total 24h Cost</span>
          <p className="text-xl font-bold text-slate-200 font-mono">$342.10 USD</p>
        </div>
      </div>

      {/* 2. Quality & Hallucination Gates */}
      <Panel className="p-5 bg-sentinel-900/40 border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Automated Claim Grounding & Hallucination Auditing</h3>
          </div>
          <Badge variant="success" size="sm" className="font-mono text-xs">
            0.04% Hallucination Rate
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 font-mono uppercase">Grounded Claims</span>
            <p className="text-base font-bold text-emerald-400 font-mono">98.7%</p>
            <p className="text-2xs text-slate-400">All statements backed by on-chain transactions</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 font-mono uppercase">Low-Confidence Rate</span>
            <p className="text-base font-bold text-amber-400 font-mono">0.82%</p>
            <p className="text-2xs text-slate-400">Automatically sanitized or routed to fallback</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 font-mono uppercase">User Satisfaction</span>
            <p className="text-base font-bold text-sky-400 font-mono">96.8%</p>
            <p className="text-2xs text-slate-400">Positive feedback on AI Trade Journal reviews</p>
          </div>
        </div>
      </Panel>

      {/* 3. Model Switchboard & Routing Controls */}
      <Panel className="p-5 bg-sentinel-900/60 border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Dynamic LLM Switchboard & Routing Governance</h3>
          </div>
          <span className="text-xs text-slate-400">Versioned in config history</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1">Active Primary Model:</label>
            <select
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              className="w-full bg-sentinel-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-sky-400 font-bold font-mono"
            >
              <option value="gemini-3.7-flash">Gemini 3.7 Flash (High Performance)</option>
              <option value="gemini-3.5-pro">Gemini 3.5 Pro (Deep Reasoning)</option>
              <option value="claude-3-7-sonnet">Claude 3.7 Sonnet</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1">Active Fallback Model:</label>
            <select
              value={fallbackModel}
              onChange={(e) => setFallbackModel(e.target.value)}
              className="w-full bg-sentinel-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Ultra-Fast)</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-medium mb-1">Grounding Strictness:</label>
            <select
              value={groundingStrictness}
              onChange={(e) => setGroundingStrictness(e.target.value)}
              className="w-full bg-sentinel-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
            >
              <option value="STANDARD">Standard (Mandatory verification for price/liq)</option>
              <option value="STRICT">Strict (Zero tolerance — block unverified claims)</option>
              <option value="LENIENT">Lenient (Permissive advisory mode)</option>
            </select>
          </div>
        </div>
      </Panel>
    </div>
  );
}
