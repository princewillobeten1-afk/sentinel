'use client';

import React from 'react';
import { clsx } from 'clsx';
import { type ValueState, describeState } from '@/lib/ui/value-state';

/**
 * Renders a numeric field so its four states are distinguishable at a glance.
 *
 * Previously every one of them collapsed to `—`, which reads as "checked,
 * nothing to report" regardless of whether the value was zero, still computing,
 * or never obtainable. On an ownership metric that is the difference between a
 * token that was audited and one that was not.
 *
 * The distinctions are carried by shape as well as colour, so they survive
 * greyscale and colour-blindness: a real value is bold, zero is plain, pending
 * is an animated ellipsis, and unavailable is a muted `n/a`.
 */
export function MetricValue({
  state,
  label,
  format = (n) => String(n),
  className,
  colorize,
}: {
  state: ValueState<number>;
  /** Used in the tooltip, e.g. "Top 10 holder concentration". */
  label: string;
  format?: (value: number) => string;
  className?: string;
  /** Optional colour ramp for a measured value. */
  colorize?: (value: number) => string;
}) {
  const title = describeState(state, label);

  if (state.kind === 'pending') {
    return (
      <span
        title={title}
        aria-label={title}
        className={clsx('inline-flex items-center gap-[2px] text-slate-500', className)}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[3px] w-[3px] rounded-full bg-current animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <span
        title={title}
        aria-label={title}
        className={clsx('text-slate-600 font-normal', className)}
      >
        n/a
      </span>
    );
  }

  if (state.kind === 'zero') {
    // Deliberately not styled as an absence. Zero is a measurement, and on a
    // concentration metric it is a good one.
    return (
      <span title={title} aria-label={title} className={clsx('font-semibold text-slate-300', className)}>
        {format(0)}
      </span>
    );
  }

  if (state.kind === 'stale') {
    return (
      <span title={title} aria-label={title} className={clsx('border-b border-dashed border-amber-700/70 font-semibold text-amber-300/80', className)}>
        {format(state.value)}
      </span>
    );
  }

  return (
    <span
      title={title}
      aria-label={title}
      className={clsx('font-semibold', colorize?.(state.value), className)}
    >
      {format(state.value)}
    </span>
  );
}
