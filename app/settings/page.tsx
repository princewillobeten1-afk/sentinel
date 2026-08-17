'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default function SettingsPage() {
  return (
    <AppShell initialView="settings">
      <DashboardShell />
    </AppShell>
  );
}
