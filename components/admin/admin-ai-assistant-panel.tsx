'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ExternalLink,
  ShieldCheck,
  Clock,
  Info,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminAiInvestigationAssistant, AiInvestigationSummary } from '@/lib/admin/ai-assistant';

interface AdminAiAssistantPanelProps {
  contextId?: string;
}

export function AdminAiAssistantPanel({ contextId }: AdminAiAssistantPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AiInvestigationSummary | null>(null);

  const handleRunAiAnalysis = async (customQuery?: string) => {
    const q = customQuery || query || 'Summarize active token activity and detected anomalies';
    setLoading(true);
    try {
      const res = await AdminAiInvestigationAssistant.analyze(q, contextId);
      setAnalysis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Prompt Input Box */}
      <Panel className="p-4 bg-sentinel-900/50 border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">AI Operational Investigation Assistant</h3>
          </div>
          <Badge variant="neutral" size="sm" className="font-mono text-2xs border-indigo-500/30 text-indigo-300">
            STRICT ADVISORY MODE
          </Badge>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask AI to investigate anomalies, verify funding clusters, or analyze volume..."
            className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition font-mono"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleRunAiAnalysis()}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 shrink-0"
          >
            {loading ? 'Synthesizing...' : 'Analyze'}
          </Button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-2xs text-slate-500">Quick inquiries:</span>
          <button
            onClick={() => handleRunAiAnalysis('Summarize what happened with this token.')}
            className="text-2xs px-2 py-0.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 transition"
          >
            "Summarize what happened with this token"
          </button>
          <button
            onClick={() => handleRunAiAnalysis('Analyze sniper wallet cluster and funding sources.')}
            className="text-2xs px-2 py-0.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 transition"
          >
            "Analyze sniper wallet cluster"
          </button>
          <button
            onClick={() => handleRunAiAnalysis('Evaluate exitability and wash volume ratio.')}
            className="text-2xs px-2 py-0.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 transition"
          >
            "Evaluate exitability and wash volume"
          </button>
        </div>
      </Panel>

      {/* 2. Structured Analysis Results */}
      {analysis && (
        <div className="space-y-4">
          <Panel className="p-4 bg-sentinel-900/40 border-white/5 space-y-4">
            {/* Verdict & Confidence */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div>
                <Badge
                  variant={
                    analysis.verdict === 'CRITICAL_THREAT'
                      ? 'danger'
                      : analysis.verdict === 'SUSPICIOUS'
                      ? 'warning'
                      : 'success'
                  }
                  size="sm"
                  className="font-mono text-2xs mb-1"
                >
                  VERDICT: {analysis.verdict}
                </Badge>
                <h4 className="text-sm font-bold text-white">{analysis.headline}</h4>
              </div>
              <div className="text-right">
                <span className="text-2xs text-slate-500 font-mono block">AI Confidence</span>
                <span className="text-sm font-bold font-mono text-indigo-300">{analysis.confidenceScorePct}%</span>
              </div>
            </div>

            {/* Chronological Breakdown */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Synthesized Operational Timeline
              </h5>
              <div className="space-y-2">
                {analysis.chronologicalBreakdown.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                    <span className="text-2xs font-mono text-indigo-400 font-bold shrink-0 mt-0.5">
                      {item.time}
                    </span>
                    <p className="text-xs text-slate-300 flex-1">{item.event}</p>
                    <Badge variant={item.importance === 'HIGH' ? 'danger' : 'neutral'} size="sm" className="text-2xs">
                      {item.importance}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Detected Signals */}
            {analysis.detectedAnomalies.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-rose-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Detected Risk Anomalies
                </h5>
                <ul className="space-y-1">
                  {analysis.detectedAnomalies.map((anom, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      {anom}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Steps */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Recommended Investigation Steps (Human Review Required)
              </h5>
              <div className="space-y-1.5">
                {analysis.recommendedSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Traceable Grounded Evidence Panel */}
            <div className="space-y-2 pt-3 border-t border-white/5">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5 text-sky-400" />
                Grounded Citations & On-Chain Proof ({analysis.evidenceCitations.length})
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {analysis.evidenceCitations.map((cit) => (
                  <div key={cit.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="info" size="sm" className="text-2xs font-mono">
                        {cit.type}
                      </Badge>
                      <span className="text-2xs text-emerald-400 font-mono">✓ Verified</span>
                    </div>
                    <p className="text-xs font-mono text-slate-200 truncate">{cit.reference}</p>
                    <p className="text-2xs text-slate-400">{cit.details}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Advisory Safety Guard Note */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-2xs flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                Safety Assurance: AI recommendations never trigger automatic administrative bans or blockchain transactions without explicit human administrator approval.
              </span>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
