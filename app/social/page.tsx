'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { SocialTrackerView } from '@/components/views/social-tracker-view';

export default function SocialTrackerPage() {
  return (
    <AppShell initialView="social" layout="workspace">
      <SocialTrackerView />
    </AppShell>
  );
}
