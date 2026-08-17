'use client';

import React, { useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { IntelligenceHeader } from '@/components/intelligence/intelligence-header';
import { DisclaimerBar } from '@/components/intelligence/disclaimer-bar';
import { HealthSummary } from '@/components/intelligence/health-summary';
import { IntelligenceSummary } from '@/components/intelligence/intelligence-summary';
import { RiskBreakdown } from '@/components/intelligence/risk-breakdown';
import { EvidencePanel } from '@/components/intelligence/evidence-panel';
import { IntelligenceTimeline } from '@/components/intelligence/intelligence-timeline';
import { PriceImpactTable } from '@/components/intelligence/price-impact-table';
import { IntelligenceActions } from '@/components/intelligence/intelligence-actions';
import { OwnershipPanel } from '@/components/intelligence/ownership-panel';
import { OwnershipGraph } from '@/components/intelligence/ownership-graph';
import { CreatorPanel } from '@/components/intelligence/creator-panel';
import { ActivityQualityCard } from '@/components/intelligence/activity-quality-card';
import { InsiderPanel } from '@/components/intelligence/insider-panel';

import { generateReport } from '@/lib/intelligence/report-generator';
import { getMockReportInput } from '@/lib/mocks/intelligence';
import { getMockOwnershipReport, MOCK_EDGES } from '@/lib/mocks/ownership-mocks';
import { getMockCreatorEntity } from '@/lib/mocks/creator-mocks';


export default function TokenIntelligencePage() {
  const params = useParams();
  const chain = (params?.chain as string) || 'solana';
  const tokenSymbol = (params?.token as string) || 'SENT';

  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  const symbol = tokenSymbol.toUpperCase();
  const input = getMockReportInput(symbol);

  if (!input) {
    return (
      <AppShell initialView="intelligence">
        <div className="max-w-4xl mx-auto py-12 text-center">
          <h1 className="text-xl font-bold text-white mb-2">Token Intelligence Not Found</h1>
          <p className="text-xs text-slate-400">
            No intelligence profile is available for token <code className="text-sky-400 font-mono">{tokenSymbol}</code> on chain <code className="text-sky-400 font-mono">{chain}</code>.
          </p>
        </div>
      </AppShell>
    );
  }

  const report = generateReport(input);
  const ownershipReport = getMockOwnershipReport(symbol);
  const creatorEntity = getMockCreatorEntity(symbol);
  const edges = MOCK_EDGES[symbol] || [];

  const handleSelectSignal = (sigId: string) => {
    setSelectedSignalId(sigId);
    const el = document.getElementById(sigId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <AppShell initialView="intelligence">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* 1. Header */}
        <IntelligenceHeader report={report} />

        {/* 2. Disclaimer */}
        <DisclaimerBar />

        {/* 3. Overview Grid: Health Summary + Actions + Explanation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <HealthSummary report={report} />
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Structured Explanation */}
            <div className="bg-sentinel-900 border border-sentinel-700/60 rounded-xl p-5 shadow-card">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <span>Sentinel Intelligence Assessment</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {report.explanation}
              </p>
            </div>

            {/* Actions */}
            <IntelligenceActions
              symbol={report.token.symbol}
              chain={report.token.chain}
              address={report.token.address}
              name={report.token.name}
            />
          </div>
        </div>

        {/* 4. Positives, Warnings, Missing Data Summary */}
        <IntelligenceSummary report={report} onSelectSignal={handleSelectSignal} />

        {/* 5. 7-Dimension Risk Breakdown */}
        <RiskBreakdown report={report} />

        {/* 6. SPRINT 6: Effective Ownership Engine Panel & Topology Graph */}
        {ownershipReport && (
          <div className="space-y-6">
            <OwnershipPanel report={ownershipReport} />
            <OwnershipGraph entities={ownershipReport.entities} edges={edges} />
          </div>
        )}

        {/* 7. SPRINT 6: Creator Reputation System Panel */}
        {creatorEntity && (
          <CreatorPanel creator={creatorEntity} />
        )}

        {/* 8. SPRINT 7: Organic Volume Detection Engine */}
        {report.organicActivity && (
          <ActivityQualityCard assessment={report.organicActivity} />
        )}

        {/* 9. SPRINT 7: Insider Detection Engine */}
        {report.insiderReport && (
          <InsiderPanel report={report.insiderReport} chain={chain} />
        )}

        {/* 10. Exitability Price Impact Simulation Table */}
        <PriceImpactTable estimates={report.priceImpactEstimates} />

        {/* 11. Detailed Evidence & Signals */}
        <EvidencePanel report={report} selectedSignalId={selectedSignalId} />

        {/* 12. Intelligence Timeline */}
        <IntelligenceTimeline events={report.recentTimeline} />
      </div>
    </AppShell>
  );
}
