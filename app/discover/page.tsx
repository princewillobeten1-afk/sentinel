'use client';

import React from 'react';
import { TradingHeader } from '@/components/trading/trading-header';
import { TokenDiscoveryPage } from '@/components/discovery/token-discovery-page';

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-sentinel-950 text-white font-mono flex flex-col">
      <TradingHeader />
      <main className="flex-1">
        <TokenDiscoveryPage />
      </main>
    </div>
  );
}
