'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { TrendsView } from '@/components/views/trends-view';

export default function TrendsPage() {
  return (
    <AppShell initialView="trends" layout="page">
      <TrendsView />
    </AppShell>
  );
}
