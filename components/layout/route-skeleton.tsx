import React from 'react';

/**
 * The shell, painted before a route's JavaScript arrives.
 *
 * Launchpad, Analytics and Settings each showed a bare centred spinner for
 * eight seconds or more before first paint. A spinner communicates "wait" and
 * nothing else — it cannot be read, navigated, or judged for progress, and on a
 * product pitching "zero-latency execution" it is the first thing a user sees.
 *
 * This mirrors the real layout — sidebar rail, header bar, content blocks — so
 * the page appears structurally complete immediately and the real content
 * replaces it in place, without the layout jumping.
 *
 * Deliberately a server component with no client JavaScript: it has to render
 * before the bundle it is covering for.
 */
export function RouteSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex min-h-screen bg-sentinel-950" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {/* Sidebar rail */}
      <div className="hidden md:flex w-[225px] shrink-0 flex-col gap-2 border-r border-white/[0.06] bg-sentinel-950 p-3">
        <div className="h-9 w-full rounded-lg bg-sentinel-900/80 animate-pulse" />
        <div className="mt-4 space-y-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-full rounded-md bg-sentinel-900/60 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="h-[52px] border-b border-white/[0.06] bg-sentinel-950 flex items-center gap-3 px-4">
          <div className="h-8 flex-1 max-w-xl rounded-lg bg-sentinel-900/70 animate-pulse" />
          <div className="h-8 w-28 rounded-lg bg-sentinel-900/70 animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1 p-3.5 space-y-3.5">
          <div className="h-24 rounded-xl border border-white/[0.06] bg-sentinel-900/50 animate-pulse" />
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-white/[0.06] bg-sentinel-900/50 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-white/[0.06] bg-sentinel-900/40 animate-pulse"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
