'use client';

import React, { useRef, useState, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DiscoveryMobileCard } from './discovery-mobile-card';
import type { DiscoveryToken } from '@/lib/discovery/types';

/** Matches the `sm:` breakpoint the grid's own Tailwind classes switch on. */
const MOBILE_BREAKPOINT_PX = 640;
const ESTIMATED_ROW_HEIGHT = 220;
const VIEWPORT_HEIGHT = 720;

interface VirtualizedMobileGridProps {
  tokens: DiscoveryToken[];
}

/**
 * Virtualizes the mobile card grid (Sprint 31 — Item 11) so DOM node count
 * stays roughly constant regardless of result count. Cards have a variable
 * height (each has its own expand/collapse toggle), so row height is
 * measured after render via `measureElement` rather than assumed fixed.
 * Column count (1 or 2, mirroring the `sm:grid-cols-2` breakpoint) is
 * tracked via `ResizeObserver` so tokens are grouped into the right number
 * of per-row virtual items as the viewport resizes.
 */
export function VirtualizedMobileGrid({ tokens }: VirtualizedMobileGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateColumns = () => setColumnCount(el.clientWidth >= MOBILE_BREAKPOINT_PX ? 2 : 1);
    updateColumns();

    const observer = new ResizeObserver(updateColumns);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(tokens.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 4,
  });

  return (
    <div ref={scrollRef} className="overflow-auto" style={{ height: VIEWPORT_HEIGHT, maxHeight: '75vh' }}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowTokens = tokens.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4"
            >
              {rowTokens.map((token) => (
                <DiscoveryMobileCard key={token.id} token={token} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
