'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { XTrackerCard } from '@/components/x-tracker/x-tracker-card';
import { useXTracker } from '@/lib/hooks/use-x-tracker';
import { Search, Flame, CheckCircle2, Sparkles, RefreshCw, Trophy } from 'lucide-react';

export default function SocialTrackerPage() {
  const { calls, stats, isLoading, refetch } = useXTracker();
  const [search, setSearch] = useState('');

  const filteredCalls = search
    ? calls.filter(
        (c) =>
          c.token.symbol.toLowerCase().includes(search.toLowerCase()) ||
          c.caller.handle.toLowerCase().includes(search.toLowerCase()) ||
          c.text.toLowerCase().includes(search.toLowerCase())
      )
    : calls;

  const kolCalls = filteredCalls.filter((c) => c.isKOL);
  const trendingCalls = filteredCalls.filter((c) => c.isTrending);
  const recentCalls = filteredCalls;

  return (
    <AppShell initialView="intelligence" layout="workspace">
      <div className="flex flex-col h-full w-full overflow-hidden bg-sentinel-950 text-slate-100">
        {/* Top Header & Metrics Ribbon */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-sentinel-800 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.08] border border-white/10 flex items-center justify-center font-bold text-white text-base shadow">
              𝕏
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-wide">X Social Alpha Tracker</h1>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/50 text-2xs font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REAL-TIME
                </span>
              </div>
              <p className="text-2xs text-slate-400 font-mono">
                Tracking top Solana callers, smart money callouts & multiplier performance
              </p>
            </div>
          </div>

          {/* Quick Stats Ticker */}
          <div className="flex items-center gap-4 text-xs font-numeric">
            <div className="px-3 py-1 rounded bg-sentinel-900 border border-sentinel-800 flex items-center gap-1.5">
              <span className="text-slate-400">Calls Today:</span>
              <span className="font-bold text-white font-mono">{stats?.totalCallsToday ?? calls.length}</span>
            </div>
            <div className="px-3 py-1 rounded bg-sentinel-900 border border-sentinel-800 flex items-center gap-1.5">
              <span className="text-slate-400">Avg Multiplier:</span>
              <span className="font-bold text-emerald-400 font-mono">{stats?.averageMultiplier ?? '2.4'}x</span>
            </div>
            <div className="px-3 py-1 rounded bg-sentinel-900 border border-sentinel-800 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Top Caller:</span>
              <span className="font-bold text-sky-400 font-mono">@hako99 (84.5% win)</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded bg-sentinel-900 border border-sentinel-800 hover:text-white hover:border-slate-600 transition"
              title="Refresh Social Feeds"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="shrink-0 px-4 py-2 border-b border-sentinel-800/60 bg-sentinel-900/30 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token symbol, caller handle, or tweet thesis..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-black/50 border border-sentinel-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/60 font-mono"
            />
          </div>
          <div className="text-2xs font-mono text-slate-400">
            Showing <strong className="text-white">{filteredCalls.length}</strong> active token callouts
          </div>
        </div>

        {/* 3-Column Terminal Workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-sentinel-800/80 overflow-hidden">
          {/* Column 1: KOL Calls */}
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 border-b border-sentinel-800/60 bg-sentinel-900/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">KOL Verified Calls</h2>
              </div>
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/50 text-sky-400">
                {kolCalls.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-white/[0.04]">
              {kolCalls.map((call) => (
                <XTrackerCard key={call.id} call={call} />
              ))}
            </div>
          </div>

          {/* Column 2: Trending Alpha */}
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 border-b border-sentinel-800/60 bg-sentinel-900/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Trending Narrative Velocity</h2>
              </div>
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
                {trendingCalls.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-white/[0.04]">
              {trendingCalls.map((call) => (
                <XTrackerCard key={call.id} call={call} />
              ))}
            </div>
          </div>

          {/* Column 3: Live Feed */}
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <div className="shrink-0 px-3.5 py-2 border-b border-sentinel-800/60 bg-sentinel-900/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">All New Calls & Mentions</h2>
              </div>
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-400">
                {recentCalls.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-white/[0.04]">
              {recentCalls.map((call) => (
                <XTrackerCard key={call.id} call={call} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
