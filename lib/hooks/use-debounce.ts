'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `value`, delayed until it has stopped changing for `delayMs`
 * (Sprint 31 — Item 10). Used to decouple an input's immediate visual state
 * from an expensive downstream trigger (e.g. a fetch) — the input itself
 * should stay bound to the raw, undebounced value so typing never lags.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
