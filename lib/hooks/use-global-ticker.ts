'use client';

import { useEffect, useState } from 'react';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData, ApiRequestError } from '@/lib/api/response';
import { useSession } from '@/lib/hooks/use-auth-hooks';

/**
 * The global ticker ribbon in the top bar.
 *
 * Every value there was a literal: `$142.50`, `+4.2%`, `TPS 2,840`,
 * `Fee 0.00005 SOL`, `Threats: 4 Flagged`. The threat count in particular
 * contradicted the Overview's own tile — the ribbon claimed four while the page
 * below reported zero, because neither was reading anything.
 *
 * TPS and network fee have **no endpoint in this codebase**. Rather than keep
 * plausible constants, they are reported as unavailable; wiring them needs a
 * Solana RPC stats route (`getRecentPerformanceSamples`, `getFeeForMessage`)
 * that does not exist yet.
 */

const REFRESH_MS = 60_000;
const TIMEOUT_MS = 8_000;

export interface GlobalTicker {
  /** Unread/active alerts across the account. `null` when unknown. */
  threatCount: number | null;
  isLoading: boolean;
}

export function useGlobalTicker(): GlobalTicker {
  const [threatCount, setThreatCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Alerts are account-scoped, so there is nothing to ask for while signed out.
   *
   * This polled unconditionally on a 60s interval, which meant a signed-out tab
   * issued a 401 every minute for as long as it stayed open — a request that
   * could not succeed, retried forever. The count was already discarded on 401,
   * so every one of those round trips was pure noise in the server log and in
   * the user's network tab.
   *
   * `isAuthenticated` is reactive, so signing in re-runs this effect and the
   * poll starts immediately rather than waiting out the interval.
   */
  const { isAuthenticated } = useSession();

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      // Not an empty account — an unknown one. `null` renders as a dash.
      setThreatCount(null);
      setIsLoading(false);
      return;
    }

    const load = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(apiUrl(endpoints.alerts.events, { limit: 50 }), {
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await readApiData<{ alerts: { severity: string | null; readState: string }[] }>(
          res,
          'Failed to load alerts',
        );
        if (cancelled) return;
        const active = (data.alerts ?? []).filter(
          (a) => a.readState === 'UNREAD' && (a.severity === 'CRITICAL' || a.severity === 'HIGH'),
        );
        setThreatCount(active.length);
      } catch (err) {
        if (cancelled) return;
        // Signed out is not a count of zero — it is no count at all.
        if (err instanceof ApiRequestError && err.status === 401) setThreatCount(null);
        else setThreatCount(null);
      } finally {
        clearTimeout(timer);
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated]);

  return { threatCount, isLoading };
}
