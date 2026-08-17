/**
 * Data Freshness Tracker
 *
 * Every intelligence report must know whether its inputs are:
 * CURRENT | RECENT | DELAYED | STALE | MISSING
 *
 * Never allow stale data to silently produce a report that appears current.
 */

import type { DataFreshness, DataSourceFreshness, FreshnessLevel } from './types';

/** Freshness thresholds in milliseconds */
const THRESHOLDS = {
  CURRENT: 30_000,     // < 30 seconds
  RECENT: 120_000,     // < 2 minutes
  DELAYED: 300_000,    // < 5 minutes
  STALE: 900_000,      // < 15 minutes
  // Beyond 15 minutes = MISSING
};

/**
 * Classify a single data source's freshness based on its timestamp.
 */
export function classifyFreshness(lastUpdated: string | null | undefined): FreshnessLevel {
  if (!lastUpdated) return 'MISSING';

  const ageMs = Date.now() - new Date(lastUpdated).getTime();
  if (isNaN(ageMs) || ageMs < 0) return 'MISSING';

  if (ageMs < THRESHOLDS.CURRENT) return 'CURRENT';
  if (ageMs < THRESHOLDS.RECENT) return 'RECENT';
  if (ageMs < THRESHOLDS.DELAYED) return 'DELAYED';
  if (ageMs < THRESHOLDS.STALE) return 'STALE';
  return 'MISSING';
}

/**
 * Build a DataFreshness report from multiple data sources.
 */
export function computeDataFreshness(
  sources: { name: string; lastUpdated: string | null | undefined }[],
): DataFreshness {
  const now = new Date().toISOString();

  const sourceFreshness: DataSourceFreshness[] = sources.map(s => ({
    source: s.name,
    lastUpdated: s.lastUpdated || 'N/A',
    level: classifyFreshness(s.lastUpdated),
  }));

  // Overall freshness = worst of all sources
  const levels: FreshnessLevel[] = ['CURRENT', 'RECENT', 'DELAYED', 'STALE', 'MISSING'];
  let worstIdx = 0;
  let stalestSource: string | undefined;

  for (const sf of sourceFreshness) {
    const idx = levels.indexOf(sf.level);
    if (idx > worstIdx) {
      worstIdx = idx;
      stalestSource = sf.source;
    }
  }

  return {
    overall: levels[worstIdx],
    sources: sourceFreshness,
    stalestSource,
    lastChecked: now,
  };
}

/**
 * Format freshness level for display.
 */
export function freshnessLabel(level: FreshnessLevel): string {
  switch (level) {
    case 'CURRENT': return 'Current';
    case 'RECENT': return 'Recent';
    case 'DELAYED': return 'Delayed';
    case 'STALE': return 'Stale';
    case 'MISSING': return 'Missing';
  }
}

export function freshnessColor(level: FreshnessLevel): string {
  switch (level) {
    case 'CURRENT': return '#12B574';
    case 'RECENT': return '#22C489';
    case 'DELAYED': return '#E5A23D';
    case 'STALE': return '#C18430';
    case 'MISSING': return '#EC5A5F';
  }
}
