'use client';

import React, { useState } from 'react';
import { Code2 } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs';
import { ApiKeyList } from '@/components/developer/api-key-list';
import { WebhookList } from '@/components/developer/webhook-list';
import { UsagePanel } from '@/components/developer/usage-panel';

type DeveloperTab = 'keys' | 'webhooks' | 'usage';

export function DeveloperDashboardView() {
  const [activeTab, setActiveTab] = useState<DeveloperTab>('keys');

  return (
    <div className="space-y-6 max-w-5xl">
      <div data-page-header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sentinel-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Code2 className="h-6 w-6 text-sky-400" /> Developer Platform
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            API keys, webhooks and usage for programmatic access to Sentinel — see{' '}
            <span className="font-mono text-slate-300">docs/api/</span> and the TypeScript SDK.
          </p>
        </div>

        <Tabs
          tabs={[
            { id: 'keys', label: 'API Keys' },
            { id: 'webhooks', label: 'Webhooks' },
            { id: 'usage', label: 'Usage' },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as DeveloperTab)}
        />
      </div>

      {activeTab === 'keys' && <ApiKeyList />}
      {activeTab === 'webhooks' && <WebhookList />}
      {activeTab === 'usage' && <UsagePanel />}
    </div>
  );
}
