'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default function HelpPage() {
  return (
    <AppShell initialView="help">
      <DashboardShell />
    </AppShell>
  );
}
