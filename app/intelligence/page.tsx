'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { HealthSummary } from '@/components/intelligence/health-summary';
import { generateReport } from '@/lib/intelligence/report-generator';
import { getMockReportInput, getAllMockSymbols } from '@/lib/mocks/intelligence';
import { ShieldCheck, Search, ArrowRight, Activity } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default function IntelligenceOverviewPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const symbols = getAllMockSymbols();
  const reports = symbols
    .map((sym) => {
      const input = getMockReportInput(sym);
      return input ? generateReport(input) : null;
    })
    .filter(Boolean);

  const filteredReports = reports.filter((r) => {
    if (!r) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.token.name.toLowerCase().includes(q) ||
      r.token.symbol.toLowerCase().includes(q) ||
      r.token.address.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell initialView="intelligence">
      <div data-active-view="intelligence" className="space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div data-page-header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-sky-400" />
              <span>Intelligence</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Explore example risk reports across seven dimensions. This preview uses sample token data.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              aria-label="Search intelligence reports"
              placeholder="Search by token, symbol or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sentinel-950 border border-sentinel-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
        </div>

        {/* Token Grid */}
        {filteredReports.length === 0 && <EmptyState icon={Search} title="No matching reports" description="Try a different token name, symbol, or address." actionLabel="Clear search" onAction={() => setSearchQuery('')} />}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredReports.map((report) => {
            if (!report) return null;
            return (
              <div
                key={report.token.id}
                className="min-w-0 bg-sentinel-900 border border-sentinel-700/60 rounded-lg p-4 flex flex-col justify-between group"
              >
                <div>
                  {/* Token Header */}
                  <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-sentinel-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sentinel-800 border border-sentinel-700 flex items-center justify-center font-bold text-xs text-sky-400 font-mono">
                        {report.token.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white group-hover:text-sky-300 transition-colors">
                          {report.token.name}
                        </div>
                        <div className="text-2xs text-slate-400 font-mono">{report.token.symbol} • {report.token.chain}</div>
                      </div>
                    </div>
                  </div>

                  {/* Health Summary Snapshot */}
                  <HealthSummary report={report} compact />
                </div>

                {/* View Details Link */}
                <div className="mt-4 pt-3 border-t border-sentinel-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-2xs">
                    Confidence: <span className="text-sky-400 font-semibold">{report.confidence.score}%</span>
                  </span>
                  <Link
                    href={`/intelligence/${report.chain}/${encodeURIComponent(report.token.symbol)}`}
                    className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <span>Full Analysis</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
