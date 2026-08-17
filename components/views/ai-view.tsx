'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Activity,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Zap,
  ArrowRight,
  Layers,
  BarChart3,
  Scale,
  RefreshCw,
  Sliders,
  HelpCircle,
  Coins,
  Wallet,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EvidenceBuilder } from '@/lib/ai/evidence-builder';
import { TokenAiAnalyst, TokenAnalystReport } from '@/lib/ai/token-analyst';
import { WhatChangedEngine } from '@/lib/ai/what-changed';
import { TraderCopilot } from '@/lib/ai/copilot';
import { CreatorAiAnalyst } from '@/lib/ai/creator-analyst';
import { WalletAiAnalyst } from '@/lib/ai/wallet-analyst';
import { PortfolioAiAnalyst } from '@/lib/ai/portfolio-analyst';
import { AiAudiencePersona, WhatChangedAnalysis, PreTradeCheckResult, SearchFilterTranslation } from '@/lib/ai/types';

type AiTab = 'ANALYST' | 'COPILOT' | 'WHAT_CHANGED' | 'TRADE_CHECK' | 'PROFILER' | 'PORTFOLIO' | 'NL_SEARCH';

export function AiView() {
  const [activeTab, setActiveTab] = useState<AiTab>('ANALYST');
  const [persona, setPersona] = useState<AiAudiencePersona>('ADVANCED');
  const [tokenAddress, setTokenAddress] = useState('So11111111111111111111111111111111111111112');
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Active token evidence & report state
  const [currentEvidence, setCurrentEvidence] = useState(() =>
    EvidenceBuilder.buildEvidencePackage({ tokenAddress: 'So11111111111111111111111111111111111111112' })
  );
  const [report, setReport] = useState<TokenAnalystReport>(() =>
    TokenAiAnalyst.generateReport(
      EvidenceBuilder.buildEvidencePackage({ tokenAddress: 'So11111111111111111111111111111111111111112' }),
      'ADVANCED'
    )
  );

  // Copilot messages
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; structured?: any }>>([
    {
      sender: 'ai',
      text: `Sentinel AI Co-Pilot active for ${currentEvidence.symbol} (${currentEvidence.name}). I explain, combine, and prioritize verified on-chain facts. How can I assist your trading decisions?`,
    },
  ]);

  // What Changed state
  const [whatChangedResult, setWhatChangedResult] = useState<WhatChangedAnalysis | null>(null);

  // Trade check state
  const [orderSize, setOrderSize] = useState('500');
  const [maxSlippage, setMaxSlippage] = useState('3.0');
  const [userProfile, setUserProfile] = useState<'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'>('BALANCED');
  const [tradeCheckResult, setTradeCheckResult] = useState<PreTradeCheckResult | null>(null);

  // Profiler state
  const [targetAddress, setTargetAddress] = useState('creator_So111111111');
  const [profilerType, setProfilerType] = useState<'CREATOR' | 'WALLET'>('CREATOR');
  const [profilerResult, setProfilerResult] = useState<any>(null);

  // NL Search state
  const [nlSearchQuery, setNlSearchQuery] = useState('Find newly launched tokens with low insider concentration and at least $100k liquidity');
  const [nlSearchResult, setNlSearchResult] = useState<SearchFilterTranslation | null>(null);

  // Handler: Re-generate Token Report
  const handleGenerateReport = (addr = tokenAddress, newPersona = persona) => {
    setIsProcessing(true);
    const newEvidence = EvidenceBuilder.buildEvidencePackage({ tokenAddress: addr });
    setCurrentEvidence(newEvidence);
    const newReport = TokenAiAnalyst.generateReport(newEvidence, newPersona);
    setReport(newReport);
    setIsProcessing(false);
  };

  // Handler: Send Copilot Query
  const handleSendCopilot = async (overridePrompt?: string) => {
    const q = overridePrompt || inputQuery;
    if (!q.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setInputQuery('');
    setIsProcessing(true);

    try {
      const resp = await TraderCopilot.handleContextualQuery({
        query: q,
        context: {
          activePage: 'trade',
          activeTokenAddress: tokenAddress,
        },
        evidenceOverride: currentEvidence,
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: resp.summary + (resp.whyExplanation?.length ? `\n\nKey Observations:\n${resp.whyExplanation.map((w) => `• ${w}`).join('\n')}` : ''),
          structured: resp,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'AI reasoning temporarily unavailable. Displaying underlying deterministic score: ' + currentEvidence.exitability.exitabilityScore + '/100.',
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Run What Changed
  const handleRunWhatChanged = (timeframe: '15m' | '1h' | '24h' = '15m') => {
    setIsProcessing(true);
    const prev = {
      liquidity: {
        totalLiquidityUsd: currentEvidence.liquidity.totalLiquidityUsd * 1.25,
        liquidityChange24hPct: currentEvidence.liquidity.liquidityChange24hPct + 15,
      },
      holders: {
        top10HoldersPct: currentEvidence.holders.top10HoldersPct - 4.5,
        creatorLinkedWalletsPct: currentEvidence.holders.creatorLinkedWalletsPct + 2.0,
      },
      volume: {
        uniqueTraders24h: Math.round(currentEvidence.volume.uniqueTraders24h * 0.85),
      },
      exitability: {
        exitabilityScore: currentEvidence.exitability.exitabilityScore + 16,
      },
    };

    const res = WhatChangedEngine.compareSnapshots({
      previous: prev,
      current: currentEvidence,
      timeframe,
    });
    setWhatChangedResult(res);
    setIsProcessing(false);
  };

  // Handler: Run Pre-Trade Check
  const handleRunTradeCheck = () => {
    setIsProcessing(true);
    const res = TraderCopilot.evaluateTradeCheck(
      {
        tokenAddress,
        tradeType: 'BUY',
        orderSizeUsd: parseFloat(orderSize) || 500,
        maxSlippagePct: parseFloat(maxSlippage) || 3.0,
        userProfile,
      },
      currentEvidence
    );
    setTradeCheckResult(res);
    setIsProcessing(false);
  };

  // Handler: Run Profiler
  const handleRunProfiler = () => {
    setIsProcessing(true);
    if (profilerType === 'CREATOR') {
      const res = CreatorAiAnalyst.analyzeCreator({ creatorAddress: targetAddress });
      setProfilerResult(res);
    } else {
      const res = WalletAiAnalyst.analyzeWallet({ walletAddress: targetAddress });
      setProfilerResult(res);
    }
    setIsProcessing(false);
  };

  // Handler: Run NL Search Translation
  const handleRunNlSearch = () => {
    setIsProcessing(true);
    const res = TraderCopilot.translateSearchQuery(nlSearchQuery);
    setNlSearchResult(res);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-sentinel-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Sentinel AI Intelligence Terminal
                <Badge variant="outline" size="sm" className="font-mono text-2xs text-sky-400 border-sky-500/40">
                  EVIDENCE-GROUNDED v2.4
                </Badge>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                AI does not replace intelligence engines — AI explains, prioritizes, and audits using verified blockchain data.
              </p>
            </div>
          </div>
        </div>

        {/* Global Token Input & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Input
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="Token Address / Mint"
              className="text-xs font-mono pr-8"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleGenerateReport(tokenAddress, persona)}
            isLoading={isProcessing}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Audit
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-sentinel-800/80 pb-2">
        <button
          onClick={() => setActiveTab('ANALYST')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'ANALYST'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Token Analyst Report
        </button>

        <button
          onClick={() => setActiveTab('COPILOT')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'COPILOT'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900'
          }`}
        >
          <Bot className="h-3.5 w-3.5" /> Contextual Copilot
        </button>

        <button
          onClick={() => {
            setActiveTab('WHAT_CHANGED');
            if (!whatChangedResult) handleRunWhatChanged('15m');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'WHAT_CHANGED'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900'
          }`}
        >
          <Clock className="h-3.5 w-3.5" /> "What Changed?"
        </button>

        <button
          onClick={() => {
            setActiveTab('TRADE_CHECK');
            if (!tradeCheckResult) handleRunTradeCheck();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'TRADE_CHECK'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Pre-Trade Risk Check
        </button>

        <button
          onClick={() => {
            setActiveTab('PROFILER');
            if (!profilerResult) handleRunProfiler();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'PROFILER'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900'
          }`}
        >
          <User className="h-3.5 w-3.5" /> Creator & Wallet Profiler
        </button>

        <button
          onClick={() => setActiveTab('PORTFOLIO')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'PORTFOLIO'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> Portfolio Risk Center
        </button>

        <button
          onClick={() => {
            setActiveTab('NL_SEARCH');
            if (!nlSearchResult) handleRunNlSearch();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'NL_SEARCH'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900'
          }`}
        >
          <Search className="h-3.5 w-3.5" /> NL Search Translator
        </button>
      </div>

      {/* ── TAB 1: TOKEN ANALYST REPORT ── */}
      {activeTab === 'ANALYST' && (
        <div className="space-y-6">
          {/* Persona Switcher & Safety Alert */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-sentinel-900/60 border border-sentinel-800">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-medium text-slate-300">Explanation Depth Mode (§60):</span>
              <div className="flex gap-1">
                {(['BEGINNER', 'ADVANCED', 'QUANT'] as AiAudiencePersona[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPersona(p);
                      handleGenerateReport(tokenAddress, p);
                    }}
                    className={`px-2.5 py-1 rounded text-2xs font-mono transition-colors ${
                      persona === p
                        ? 'bg-sky-500 text-white font-semibold shadow-sm'
                        : 'bg-sentinel-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-2xs text-slate-400">
              <span title="Confidence in analysis reliability given available evidence, not success probability. (§12)">
                Analysis Confidence: <span className="font-mono text-emerald-400 font-semibold">{report.confidencePct}%</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="font-mono text-slate-500 truncate max-w-[140px]">{report.dataSnapshotHash}</span>
            </div>
          </div>

          {/* Risk Summary Banner (§13) */}
          <Panel
            className={`p-5 border ${
              report.overallRisk === 'HIGH' || report.overallRisk === 'CRITICAL'
                ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-sentinel-950 to-sentinel-950'
                : report.overallRisk === 'MEDIUM'
                  ? 'border-sky-500/40 bg-gradient-to-r from-sky-950/20 via-sentinel-950 to-sentinel-950'
                  : 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/20 via-sentinel-950 to-sentinel-950'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={report.overallRisk === 'HIGH' || report.overallRisk === 'CRITICAL' ? 'danger' : 'success'}
                    size="sm"
                    className="font-mono uppercase tracking-wider font-bold"
                  >
                    {report.overallRisk} RISK
                  </Badge>
                  <h2 className="text-lg font-bold text-white">
                    {report.name} ({report.symbol}) Risk Explanation
                  </h2>
                </div>

                <div className="text-xs text-slate-300 space-y-1 mt-2">
                  <div className="font-semibold text-slate-200">Why:</div>
                  <ul className="space-y-1 pl-1">
                    {report.whyRiskyBullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-300">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {report.mainConcern && (
                  <div className="mt-3 p-3 rounded-lg bg-sentinel-900/90 border border-sentinel-800 text-xs">
                    <span className="font-semibold text-amber-400">Main concern: </span>
                    <span className="text-slate-300">{report.mainConcern}</span>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* 12-Section Breakdown Grid (§15) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel className="p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-sky-400" /> Token Overview & Market
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{report.sections.tokenOverview}</p>
              <p className="text-xs text-slate-400 font-mono">{report.sections.market}</p>
            </Panel>

            <Panel className="p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-400" /> Pool Liquidity
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{report.sections.liquidity}</p>
            </Panel>

            <Panel className="p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-purple-400" /> Supply Ownership & Holders
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{report.sections.ownership}</p>
            </Panel>

            <Panel className="p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-indigo-400" /> Creator Reputation
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{report.sections.creator}</p>
            </Panel>

            <Panel className="p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> Volume Quality & Wash Trading
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{report.sections.volumeQuality}</p>
            </Panel>

            <Panel className="p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" /> Insider Activity & Snipers
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{report.sections.insiderActivity}</p>
            </Panel>

            <Panel className="p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" /> Exitability & Execution Depth
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{report.sections.exitability}</p>
            </Panel>

            <Panel className="p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-400" /> Contract Security Controls
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{report.sections.contractRisk}</p>
            </Panel>
          </div>

          {/* What to Watch */}
          <Panel className="p-4 space-y-2 bg-sentinel-950 border border-sentinel-800">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" /> What to Watch
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {report.sections.whatToWatch.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-sky-400 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {/* ── TAB 2: CONTEXTUAL COPILOT ── */}
      {activeTab === 'COPILOT' && (
        <div className="space-y-4">
          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1 py-1">Quick Inquiries:</span>
            {[
              'Is there anything suspicious here?',
              'Why is this token risky?',
              'Who appears to control the supply?',
              'Can I realistically exit this position?',
              'Compare this token with peer launchpad coins',
            ].map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendCopilot(qp)}
                className="px-2.5 py-1 rounded-full bg-sentinel-900 border border-sentinel-800 text-2xs text-sky-300 hover:bg-sky-500/10 hover:border-sky-500/30 transition-colors"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Chat Stream Window */}
          <Panel className="h-[480px] flex flex-col p-0 border border-sentinel-800">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.sender === 'ai' && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-xl p-3.5 rounded-xl leading-relaxed whitespace-pre-line ${
                      m.sender === 'user'
                        ? 'bg-sky-500/20 text-sky-100 border border-sky-500/30'
                        : 'bg-sentinel-900/90 text-slate-200 border border-sentinel-800 shadow-md'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.sender === 'user' && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sentinel-800 text-slate-300 shrink-0 mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isProcessing && (
                <div className="flex gap-3 items-center text-xs text-sky-400 animate-pulse">
                  <Bot className="h-4 w-4" />
                  <span>Synthesizing verified on-chain evidence...</span>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-sentinel-800 bg-sentinel-950 flex items-center gap-2">
              <Input
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCopilot()}
                placeholder={`Ask Copilot about ${currentEvidence.symbol}, wallet links, or price impact...`}
                className="text-xs font-mono"
              />
              <Button
                onClick={() => handleSendCopilot()}
                variant="primary"
                size="sm"
                isLoading={isProcessing}
                rightIcon={<Send className="h-3.5 w-3.5" />}
              >
                Send
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {/* ── TAB 3: WHAT CHANGED ── */}
      {activeTab === 'WHAT_CHANGED' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-400" /> "What Changed?" State Diff Inspector (§17-18)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically compares previous token state vs current state to identify rapid liquidity, holder, and exitability shifts.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {(['15m', '1h', '24h'] as const).map((tf) => (
                <Button
                  key={tf}
                  variant={whatChangedResult?.timeframe === tf ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleRunWhatChanged(tf)}
                >
                  Last {tf}
                </Button>
              ))}
            </div>
          </div>

          {whatChangedResult && (
            <Panel className="p-5 space-y-4 border border-sentinel-800">
              <div className="flex items-center justify-between border-b border-sentinel-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={whatChangedResult.overallRiskTrend === 'INCREASED' ? 'danger' : 'success'}
                    size="sm"
                    className="font-mono uppercase"
                  >
                    Trend: {whatChangedResult.overallRiskTrend} RISK
                  </Badge>
                  <span className="text-xs text-slate-300 font-semibold">{whatChangedResult.summary}</span>
                </div>
                <span className="text-2xs font-mono text-slate-500">{whatChangedResult.generatedAt}</span>
              </div>

              <div className="space-y-2.5">
                {whatChangedResult.changes.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono ${
                      item.type === 'WARNING'
                        ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                        : item.type === 'POSITIVE'
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-sentinel-900 border-sentinel-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.type === 'WARNING' && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />}
                      {item.type === 'POSITIVE' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                      {item.type === 'NEUTRAL' && <Info className="h-4 w-4 text-sky-400 shrink-0" />}
                      <span>{item.deltaDescription}</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                      <span>
                        {item.previousValue} → <span className="text-white font-bold">{item.currentValue}</span>
                      </span>
                      <Badge variant="outline" size="sm" className="font-mono text-2xs">
                        {item.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── TAB 4: PRE-TRADE RISK CHECK ── */}
      {activeTab === 'TRADE_CHECK' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-400" /> Pre-Trade Advisory Check (§23-24, §72-73)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Advisory trade evaluation against liquidity depth, estimated slippage, and personalized risk profiles. AI never automatically executes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Panel className="p-4 space-y-3">
              <label className="text-xs font-medium text-slate-300 block">Trade Amount ($ USD)</label>
              <Input
                type="number"
                value={orderSize}
                onChange={(e) => setOrderSize(e.target.value)}
                className="text-xs font-mono"
              />

              <label className="text-xs font-medium text-slate-300 block">Max Allowed Slippage (%)</label>
              <Input
                type="number"
                value={maxSlippage}
                onChange={(e) => setMaxSlippage(e.target.value)}
                className="text-xs font-mono"
              />

              <label className="text-xs font-medium text-slate-300 block">Risk Profile (§26)</label>
              <div className="grid grid-cols-3 gap-1">
                {(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] as const).map((prof) => (
                  <button
                    key={prof}
                    onClick={() => setUserProfile(prof)}
                    className={`py-1.5 rounded text-2xs font-mono font-medium transition-colors ${
                      userProfile === prof
                        ? 'bg-sky-500 text-white font-bold'
                        : 'bg-sentinel-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {prof}
                  </button>
                ))}
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleRunTradeCheck}
                className="w-full mt-2"
                isLoading={isProcessing}
              >
                Run Pre-Trade Audit
              </Button>
            </Panel>

            <Panel className="p-5 md:col-span-2 space-y-4 border border-sentinel-800">
              {tradeCheckResult ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-sentinel-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={tradeCheckResult.riskLevel === 'HIGH' ? 'danger' : 'success'}
                        size="sm"
                        className="font-mono uppercase font-bold"
                      >
                        {tradeCheckResult.riskLevel} RISK TRADE
                      </Badge>
                      <span className="text-xs font-bold text-white">{tradeCheckResult.summary}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-sentinel-900 border border-sentinel-800">
                      <div className="text-2xs text-slate-400 uppercase font-mono">Est. Price Impact</div>
                      <div className="text-sm font-bold font-mono text-amber-400 mt-1">
                        {tradeCheckResult.estimatedPriceImpactPct}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-sentinel-900 border border-sentinel-800">
                      <div className="text-2xs text-slate-400 uppercase font-mono">Exitability Score</div>
                      <div className="text-sm font-bold font-mono text-sky-400 mt-1">
                        {tradeCheckResult.exitabilityScore}/100
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-sentinel-900 border border-sentinel-800">
                      <div className="text-2xs text-slate-400 uppercase font-mono">Available Liquidity</div>
                      <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
                        ${tradeCheckResult.liquidityUsd.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {tradeCheckResult.conflictsWithPersonalRule && (
                    <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-rose-400">
                        <ShieldAlert className="h-4 w-4" /> Personal Risk Rule Violation (§25)
                      </div>
                      {tradeCheckResult.conflictDetails?.map((det, i) => (
                        <div key={i}>• {det}</div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {tradeCheckResult.warnings.map((w, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                    {tradeCheckResult.positives.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-sentinel-800 flex items-center justify-between">
                    <span className="text-2xs text-slate-400 italic">
                      Requires explicit human review before submitting to wallet signer.
                    </span>
                    <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                      Review in Trading Terminal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-8 text-center">
                  Configure order parameters and click "Run Pre-Trade Audit".
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* ── TAB 5: PROFILER ── */}
      {activeTab === 'PROFILER' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-sky-400" /> Creator & Wallet Behavioral Profiler (§32-34)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Distinguishes observed facts from statistical behavioral inferences with explicit confidence levels.
              </p>
            </div>

            <div className="flex gap-1.5">
              <Button
                variant={profilerType === 'CREATOR' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setProfilerType('CREATOR');
                  setTargetAddress('creator_So111111111');
                }}
              >
                Creator Profile
              </Button>
              <Button
                variant={profilerType === 'WALLET' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setProfilerType('WALLET');
                  setTargetAddress('wallet_whale_77a9');
                }}
              >
                Wallet Behavioral
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="Address / Public Key"
              className="text-xs font-mono"
            />
            <Button variant="secondary" size="sm" onClick={handleRunProfiler} isLoading={isProcessing}>
              Analyze
            </Button>
          </div>

          {profilerResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel className="p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Observed Facts (Direct Blockchain Truth)
                </h3>
                <ul className="space-y-2 text-xs text-slate-300 font-mono">
                  {profilerResult.observedFacts?.map((fact: string, idx: number) => (
                    <li key={idx} className="p-2 rounded bg-sentinel-900/80 border border-sentinel-800">
                      • {fact}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel className="p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-sky-400" /> AI Statistical Inferences & Patterns
                </h3>
                <ul className="space-y-2 text-xs text-slate-300">
                  {profilerResult.inferences?.map((inf: string, idx: number) => (
                    <li key={idx} className="p-2 rounded bg-sky-950/20 border border-sky-500/30 text-sky-200">
                      • {inf}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-sentinel-800 flex justify-between text-xs">
                  <span className="text-slate-400">Attribution Confidence:</span>
                  <Badge variant="outline" size="sm" className="font-mono text-sky-300">
                    {profilerResult.confidence} CONFIDENCE
                  </Badge>
                </div>
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 6: PORTFOLIO RISK CENTER ── */}
      {activeTab === 'PORTFOLIO' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-400" /> AI Portfolio Risk & Exitability Analyst (§63-64)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Consumes deterministic portfolio exposure, liquidity depth, and exitability metrics.
            </p>
          </div>

          <Panel className="p-5 space-y-4 border border-sentinel-800">
            {(() => {
              const samplePositions = [
                {
                  tokenAddress: 'TokenA111111111111111111111111111111111',
                  symbol: 'ABC',
                  valueUsd: 4200,
                  allocationPct: 42.0,
                  liquidityUsd: 420_000,
                  exitabilityScore: 41,
                  hasLiquidityDrainWarning: true,
                },
                {
                  tokenAddress: 'TokenB222222222222222222222222222222222',
                  symbol: 'SOL',
                  valueUsd: 4800,
                  allocationPct: 48.0,
                  liquidityUsd: 25_000_000,
                  exitabilityScore: 98,
                  hasLiquidityDrainWarning: false,
                },
                {
                  tokenAddress: 'TokenC333333333333333333333333333333333',
                  symbol: 'MEME',
                  valueUsd: 1000,
                  allocationPct: 10.0,
                  liquidityUsd: 35_000,
                  exitabilityScore: 32,
                  hasLiquidityDrainWarning: true,
                },
              ];
              const pAnalysis = PortfolioAiAnalyst.analyzePortfolio(samplePositions);

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-sentinel-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={pAnalysis.portfolioRiskRating === 'HIGH' ? 'danger' : 'success'}
                        size="sm"
                        className="font-mono uppercase font-bold"
                      >
                        {pAnalysis.portfolioRiskRating} RISK PORTFOLIO
                      </Badge>
                      <span className="text-xs text-slate-300">{pAnalysis.summary}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-sentinel-900 border border-sentinel-800">
                      <div className="text-2xs text-slate-400 uppercase font-mono">Low-Liquidity Exposure</div>
                      <div className="text-base font-bold font-mono text-amber-400 mt-1">
                        {pAnalysis.lowLiquidityExposurePct}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-sentinel-900 border border-sentinel-800">
                      <div className="text-2xs text-slate-400 uppercase font-mono">Deteriorating Positions</div>
                      <div className="text-base font-bold font-mono text-rose-400 mt-1">
                        {pAnalysis.deterioratingExitabilityCount}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-300">Top Risk Contributors:</h4>
                    {pAnalysis.topRiskContributors.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-sentinel-900/80 border border-sentinel-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">{c.symbol}</span>
                          <span className="text-slate-400 font-mono">({c.allocationPct}% of portfolio)</span>
                          <span className="text-slate-300">{c.primaryConcern}</span>
                        </div>
                        <Badge variant="outline" size="sm" className="font-mono text-amber-400">
                          Exit: {c.exitabilityScore}/100
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg bg-sky-950/20 border border-sky-500/30 text-xs text-sky-200">
                    <span className="font-bold text-sky-400">Actionable AI Insights: </span>
                    {pAnalysis.actionableInsights.join(' ')}
                  </div>
                </div>
              );
            })()}
          </Panel>
        </div>
      )}

      {/* ── TAB 7: NL SEARCH TRANSLATOR ── */}
      {activeTab === 'NL_SEARCH' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Search className="h-4 w-4 text-sky-400" /> Natural Language Search to Deterministic Filter Translator (§30)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              AI translates colloquial trader intent into structured database queries. AI never fabricates candidate tokens.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={nlSearchQuery}
              onChange={(e) => setNlSearchQuery(e.target.value)}
              placeholder="e.g. Find newly launched tokens with growing organic volume, low insider concentration and at least $100k liquidity"
              className="text-xs"
            />
            <Button variant="primary" size="sm" onClick={handleRunNlSearch} isLoading={isProcessing}>
              Translate
            </Button>
          </div>

          {nlSearchResult && (
            <Panel className="p-5 space-y-4 border border-sentinel-800">
              <div className="flex items-center justify-between border-b border-sentinel-800 pb-3">
                <span className="text-xs font-bold text-white">{nlSearchResult.interpretedIntent}</span>
                <Badge variant="outline" size="sm" className="font-mono text-emerald-400">
                  {nlSearchResult.confidence} CONFIDENCE
                </Badge>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300">Compiled Deterministic Database Filters:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
                  {Object.entries(nlSearchResult.filters).map(([k, v]) => (
                    <div key={k} className="p-2.5 rounded bg-sentinel-900 border border-sentinel-800">
                      <div className="text-2xs text-slate-400">{k}</div>
                      <div className="text-white font-bold mt-0.5">{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-sentinel-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">
                  Ranking Criteria:{' '}
                  <span className="font-mono text-sky-300">{nlSearchResult.rankingCriteria.join(', ')}</span>
                </span>
                <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                  Execute Discovery Query
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
