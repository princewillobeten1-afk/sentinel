'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Award,
  Zap,
  Flame,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Share2,
  TrendingUp,
  Sparkles,
  Users,
  ShieldCheck,
  AlertTriangle,
  History,
  X,
} from 'lucide-react';
import type { TokenLoreData, RunnerInfo } from '@/lib/lore/lore-types';
import { Drawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';

export interface TokenLoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lore: TokenLoreData | null;
  isLoading?: boolean;
}

export function TokenLoreDrawer({ isOpen, onClose, lore, isLoading }: TokenLoreDrawerProps) {
  const [activeTab, setActiveTab] = useState<'lore' | 'catalysts' | 'runners'>('lore');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyNarrative = () => {
    if (!lore) return;
    const text = `${lore.name} ($${lore.symbol}) Lore:\n${lore.loreSummary}\n\nRunner Status: ${lore.runnerStatus.badgeLabel}\nVirality Score: ${lore.viralityScore}/100`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMint = (mint: string) => {
    navigator.clipboard.writeText(mint);
    setCopiedAddress(mint);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      className="max-w-xl w-full bg-[#090d16] border-slate-800 text-slate-100 flex flex-col"
    >
      {/* Custom Header */}
      <div className="p-5 border-b border-slate-800/80 bg-[#0d1322] shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  {lore?.name || 'Token'}
                  <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                    ${lore?.symbol || '---'}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>The Lore & Narrative Intel</span>
                <span>•</span>
                <span className="text-indigo-400 font-medium">{lore?.narrativeCategory || 'Memecoin Lore'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyNarrative}
              className="p-1.5 rounded-lg border border-slate-700/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copy Narrative Summary"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-700/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Runner Status Banner */}
        {lore && (
          <div className="mt-4 p-3 rounded-xl border bg-slate-900/90 relative overflow-hidden transition-all">
            {lore.runnerStatus.isFirstRunner ? (
              <div className="flex items-center justify-between gap-3 border-l-4 border-amber-400 pl-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                    <Award className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-wide text-amber-300 uppercase">
                        🥇 First Runner (OG)
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Pioneer Contract
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {lore.runnerStatus.explanation}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Cohort Size</div>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    1 of {lore.runnerStatus.totalRunnersInCohort}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 border-l-4 border-violet-400 pl-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0">
                    <History className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-wide text-violet-300 uppercase">
                        {lore.runnerStatus.badgeLabel}
                      </span>
                      {lore.runnerStatus.flippedOg && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                          🔥 Flipped OG
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {lore.runnerStatus.explanation}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Rank in Cohort</div>
                  <div className="text-xs font-mono font-bold text-violet-300">
                    #{lore.runnerStatus.runnerRank} of {lore.runnerStatus.totalRunnersInCohort}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-800/60">
          <button
            onClick={() => setActiveTab('lore')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'lore'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Lore & Origin</span>
          </button>
          <button
            onClick={() => setActiveTab('catalysts')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'catalysts'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Why It&apos;s Flying</span>
          </button>
          <button
            onClick={() => setActiveTab('runners')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'runners'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Runner Cohort ({lore?.otherRunners.length || 1})</span>
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#090d16]">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading narrative intel and runner analysis...</p>
          </div>
        ) : !lore ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            No narrative lore found for this token.
          </div>
        ) : (
          <>
            {/* TAB 1: Lore & Origin */}
            {activeTab === 'lore' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Headline Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1 mb-1">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Narrative Headline
                  </div>
                  <h3 className="text-base font-extrabold text-white leading-snug">
                    {lore.headline}
                  </h3>
                </div>

                {/* Backstory & Cultural Lore */}
                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    The Meme & Cultural Backstory
                  </h4>
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-sm leading-relaxed text-slate-200">
                    <p className="whitespace-pre-line">{lore.loreSummary}</p>
                  </div>
                </div>

                {/* Origin Spark Card */}
                {lore.originSpark && (
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Origin Spark
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {lore.originSpark.source}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {lore.originSpark.creatorName && (
                        <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 uppercase block font-mono">Creator</span>
                          <span className="font-semibold text-slate-200">
                            {lore.originSpark.creatorName}
                          </span>
                        </div>
                      )}
                      {lore.originSpark.sparkDate && (
                        <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 uppercase block font-mono">Date / Surge</span>
                          <span className="font-semibold text-slate-200">
                            {lore.originSpark.sparkDate}
                          </span>
                        </div>
                      )}
                    </div>

                    {lore.originSpark.sparkQuote && (
                      <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-xs italic text-indigo-200">
                        {lore.originSpark.sparkQuote}
                      </div>
                    )}

                    {lore.originSpark.sparkUrl && (
                      <a
                        href={lore.originSpark.sparkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors pt-1"
                      >
                        <span>View Original Viral Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* AI & Meta Synthesis */}
                {lore.aiAnalysis && (
                  <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                      Intel Briefing
                    </span>
                    <p>{lore.aiAnalysis}</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Why It's Flying */}
            {activeTab === 'catalysts' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Virality & Momentum Scores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Virality Score
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-numeric text-amber-400">
                        {lore.viralityScore}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">/ 100</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                        style={{ width: `${lore.viralityScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Conviction Level
                    </span>
                    <div className="text-base font-extrabold text-emerald-400">
                      {lore.communityVibe?.conviction || 'HIGH'} CONVICTION
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                      Moat: {lore.communityVibe?.narrativeMoat || 'STRONG'}
                    </span>
                  </div>
                </div>

                {/* Catalysts List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    Active Flight Catalysts
                  </h4>
                  <div className="space-y-2">
                    {lore.whyItsFlying.map((reason, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-200"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Narrative Themes */}
                {lore.communityVibe?.keyThemes && lore.communityVibe.keyThemes.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                      Narrative Keyword Moat
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {lore.communityVibe.keyThemes.map((theme, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 border border-slate-700/60 text-slate-300"
                        >
                          #{theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Runner Cohort */}
            {activeTab === 'runners' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    How Runner Detection Works
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    When a meme blows up, dozens of contracts launch with identical tickers. Sentinel tracks the on-chain creation timestamp of every pair to identify the true First Runner (OG) vs secondary launches and derivatives.
                  </p>
                </div>

                {/* Runners List */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Identified Tokens in ${lore.symbol} Cohort ({lore.otherRunners.length})
                  </div>

                  {lore.otherRunners.map((runner, index) => {
                    const isCurrent = runner.isCurrent;
                    const isOg = runner.runnerRank === 1;

                    return (
                      <div
                        key={runner.mint}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-indigo-950/30 border-indigo-500/50 ring-1 ring-indigo-500/30'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                                isOg
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {isOg ? '1' : runner.runnerRank}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white truncate">
                                  {runner.name}
                                </span>
                                {isOg && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    OG
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    CURRENT
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                                <span>{runner.mint.slice(0, 4)}...{runner.mint.slice(-4)}</span>
                                <button
                                  onClick={() => handleCopyMint(runner.mint)}
                                  className="hover:text-slate-200"
                                  title="Copy address"
                                >
                                  {copiedAddress === runner.mint ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-bold text-white">
                              {runner.marketCapUsd
                                ? `$${(runner.marketCapUsd >= 1e6
                                    ? (runner.marketCapUsd / 1e6).toFixed(1) + 'M'
                                    : (runner.marketCapUsd / 1e3).toFixed(1) + 'K')}`
                                : '—'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {runner.pairCreatedAt
                                ? new Date(runner.pairCreatedAt).toLocaleDateString()
                                : 'Active'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-[#0d1322] flex items-center justify-between text-xs text-slate-400 shrink-0">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Curated Lore & On-Chain Runner Intelligence</span>
        </span>
        <button
          onClick={handleCopyNarrative}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors flex items-center gap-1.5"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copiedLink ? 'Copied!' : 'Share Lore'}</span>
        </button>
      </div>
    </Drawer>
  );
}
