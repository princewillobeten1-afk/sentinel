'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PortfolioRiskCenter } from '@/components/portfolio/portfolio-risk-center';

export default function PortfolioRiskPage() {
  return (
    <AppShell>
      <PortfolioRiskCenter />
    </AppShell>
  );
}
