import React from 'react';
import { clsx } from 'clsx';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Cpu, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface IntelligenceFactor {
  type: 'POSITIVE' | 'WARNING';
  text: string;
}

export interface IntelligenceScoreData {
  overallScore: number; // 0 - 100
  riskScore: number;    // 0 - 100
  confidence: number;   // 0 - 100%
  status: 'Credible' | 'Caution' | 'High Risk' | 'Unverified';
  summary?: string;
  modelVersion?: string;
  isAiAvailable?: boolean;
  contributingFactors?: IntelligenceFactor[];
}

export interface IntelligenceScoreProps {
  data: IntelligenceScoreData;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  showFactors?: boolean;
  className?: string;
}

/**
 * Explainable Intelligence & Risk Score Component (Sprint 33 §29-34).
 *
 * Implements strict explainability standards:
 *   - Clear distinction between verified on-chain facts and AI statistical inferences.
 *   - Explicit contributing factors (✓ positive safety controls, ⚠ risk warnings).
 *   - Model version traceability and AI failure resilience.
 */
export function IntelligenceScore({
  data,
  size = 'md',
  showDetails = true,
  showFactors = true,
  className,
}: IntelligenceScoreProps) {
  const {
    overallScore,
    riskScore,
    confidence,
    status,
    summary,
    modelVersion = 'v2.4',
    isAiAvailable = true,
    contributingFactors,
  } = data;

  const isHigh = overallScore >= 80;
  const isMed = overallScore >= 50 && overallScore < 80;
  const isLow = overallScore < 50;

  const scoreColor = isHigh
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
    : isMed
    ? 'text-amber-400 border-amber-500/40 bg-amber-950/20'
    : 'text-rose-400 border-rose-500/40 bg-rose-950/20';

  return (
    <div className={clsx('rounded-xl border p-3.5 font-mono text-xs select-none space-y-2.5', scoreColor, className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isHigh && <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />}
          {isMed && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />}
          {isLow && <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />}
          <span className="font-bold uppercase text-slate-200">Intelligence Audit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-slate-500 flex items-center gap-0.5">
            <Cpu className="h-3 w-3 text-sky-400" /> {modelVersion}
          </span>
          <Badge variant={isHigh ? 'success' : isMed ? 'warning' : 'danger'} size="sm">
            {status}
          </Badge>
        </div>
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <div>
          <span className="text-2xs text-slate-400 block uppercase">Overall Score</span>
          <span className="text-2xl font-bold font-numeric tracking-tight">
            {overallScore}
            <span className="text-xs text-slate-500">/100</span>
          </span>
        </div>

        {showDetails && (
          <div className="text-right font-numeric text-2xs">
            <p className="text-slate-400">
              Risk Score: <strong className="text-slate-200">{riskScore}/100</strong>
            </p>
            <p className="text-slate-400">
              Confidence:{' '}
              <strong className={isAiAvailable ? 'text-sky-300' : 'text-slate-500'}>
                {isAiAvailable ? `${confidence}%` : 'N/A (Offline)'}
              </strong>
            </p>
          </div>
        )}
      </div>

      {/* Explainable Contributing Factors (Sprint 33 §30) */}
      {showFactors && contributingFactors && contributingFactors.length > 0 && (
        <div className="space-y-1 pt-1.5 border-t border-sentinel-800/80">
          <p className="text-2xs font-bold uppercase text-slate-400">Contributing Factors</p>
          <div className="space-y-1">
            {contributingFactors.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5 text-2xs">
                {f.type === 'POSITIVE' ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span className={f.type === 'POSITIVE' ? 'text-emerald-300' : 'text-rose-300'}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <p className="text-2xs font-sans text-slate-300 border-t border-sentinel-800/80 pt-2 leading-relaxed">
          {summary}
        </p>
      )}
    </div>
  );
}
