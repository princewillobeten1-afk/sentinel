'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

/**
 * Discovery, in the Sentinel shell.
 *
 * This page previously rendered its own chrome — `TradingHeader` plus
 * `TokenDiscoveryPage` — which gave the app two visual identities: a minimal
 * "SCALE TRADER / TERMINAL v2" top nav here, and the full "PROJECT SENTINEL"
 * sidebar terminal (nav, status bar, live block height, wallet) on every other
 * route. Navigating between them read as leaving one product for another.
 *
 * Routing through `AppShell` + `DashboardShell` also replaces the flat
 * three-row markets table with `DiscoverView` — the multi-column terminal with
 * independently scrolling New Launches / Trending / Bonding Migration /
 * Graduated columns, per-column filters and embedded quick-buy. `TradingHeader`
 * and `TokenDiscoveryPage` are left in place; they are still used by
 * `app/tokens/[id]`.
 */
export default function DiscoverPage() {
  return (
    <AppShell initialView="discover">
      <DashboardShell />
    </AppShell>
  );
}
