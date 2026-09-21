import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { lifecycleWorker } from '@/lib/market/lifecycle/lifecycle-worker';
import {
  finalStretch,
  migrated,
  migrating,
  newPairs,
} from '@/lib/market/lifecycle/lifecycle-engine';
import { finalStretchThreshold } from '@/lib/market/lifecycle/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/market/lifecycle
 *
 * The canonical lifecycle state, as the engine holds it.
 *
 * Exists so the classification is observable rather than inferred from what the
 * columns happen to render. An empty Final Stretch should be checkable against
 * the curve readings behind it — "nothing is above the threshold" and "curve
 * reads are failing" look identical from the outside otherwise.
 */
export async function GET(request: Request) {
  try {
    const limit = Math.min(
      50,
      Math.max(1, Number(new URL(request.url).searchParams.get('limit') ?? 10)),
    );

    const summarise = (record: ReturnType<typeof newPairs>[number]) => ({
      mint: record.mint,
      state: record.state,
      launchpad: record.launchpad,
      // Real completion from the curve account, null when not yet read.
      curveProgressPct:
        record.curve === null ? null : Number((record.curve.progress * 100).toFixed(3)),
      curveComplete: record.curve?.complete ?? null,
      curveReadAt: record.curve ? new Date(record.curve.readAt).toISOString() : null,
      stateChangedAt: new Date(record.stateChangedAt).toISOString(),
      source: record.source,
      migration: record.migration,
    });

    return jsonResponse({
      stats: lifecycleWorker.stats(),
      // Stated so an empty Final Stretch can be read against it.
      finalStretchThresholdPct: Number((finalStretchThreshold() * 100).toFixed(1)),
      newPair: newPairs().slice(0, limit).map(summarise),
      finalStretch: finalStretch().slice(0, limit).map(summarise),
      migrating: migrating().slice(0, limit).map(summarise),
      migrated: migrated().slice(0, limit).map(summarise),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to read lifecycle state', 500),
    );
  }
}
