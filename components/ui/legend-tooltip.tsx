'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

export interface LegendTooltipProps {
  label: string;
  definition: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  badge?: string;
}

function parseDefinitionString(text: string) {
  const sourceIndex = text.search(/\s*(?:Source:|\bSource\b:?)\s*/i);
  if (sourceIndex === -1) {
    return { description: text, provenance: null };
  }

  const description = text.substring(0, sourceIndex).trim().replace(/\.\s*$/, '');
  const rawProvenance = text.substring(sourceIndex).trim().replace(/^Source:\s*/i, '');

  const sentences = rawProvenance.split(/\.\s+/).filter(Boolean);
  let source = '';
  let status = '';
  let observed = '';
  let reason = '';

  if (sentences.length > 0) {
    const s0 = sentences[0];
    if (s0.includes(';')) {
      const parts = s0.split(';').map((p) => p.trim());
      source = parts[0] || '';
      status = parts[1] || '';
      observed = parts[2]?.replace(/^observed\s*/i, '') || '';
      if (sentences.length > 1) {
        reason = sentences.slice(1).join('. ');
      }
    } else {
      source = s0;
      if (sentences.length > 1) {
        const s1 = sentences[1];
        const segs = s1.split(',').map((s) => s.trim());
        status = segs[0] || '';
        observed = segs[1]?.replace(/^observed\s*/i, '') || '';
        if (sentences.length > 2) {
          reason = sentences.slice(2).join('. ');
        }
      }
    }
  }

  return {
    description,
    provenance: {
      source: source || 'On-chain',
      status: status || undefined,
      observed: observed || undefined,
      reason: reason || undefined,
    },
  };
}

function renderDefinitionContent(definition: string | React.ReactNode) {
  if (typeof definition !== 'string') {
    return definition;
  }

  const { description, provenance } = parseDefinitionString(definition);

  if (!provenance) {
    return (
      <p className="text-[11px] text-slate-200 leading-relaxed text-left font-normal break-words">
        {definition}
      </p>
    );
  }

  const isStatusPositive =
    provenance.status &&
    (provenance.status.toLowerCase().includes('measur') ||
      provenance.status.toLowerCase().includes('safe') ||
      provenance.status.toLowerCase().includes('live'));

  const isStatusWarning =
    provenance.status &&
    (provenance.status.toLowerCase().includes('stale') ||
      provenance.status.toLowerCase().includes('warn') ||
      provenance.status.toLowerCase().includes('load'));

  return (
    <div className="space-y-2 text-left font-sans">
      {description && (
        <p className="text-[11px] text-slate-200 leading-relaxed font-normal break-words">
          {description}.
        </p>
      )}
      <div className="rounded border border-slate-800 bg-slate-950/80 p-2 space-y-1.5 text-[10px] font-mono">
        <div className="flex items-center justify-between gap-1">
          <span className="text-slate-400">
            <span className="text-slate-500">Source: </span>
            <span className="text-slate-200 font-semibold">{provenance.source}</span>
          </span>
          {provenance.status && (
            <span
              className={clsx(
                'px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border',
                isStatusPositive
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                  : isStatusWarning
                  ? 'bg-amber-950/80 text-amber-400 border-amber-800/60'
                  : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
              )}
            >
              {provenance.status}
            </span>
          )}
        </div>
        {provenance.observed && (
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span className="text-slate-500">Observed:</span>
            <span className="text-slate-300">{provenance.observed}</span>
          </div>
        )}
        {provenance.reason && (
          <div className="pt-1 mt-1 border-t border-slate-800/80 text-amber-300 text-[10px] leading-tight break-words">
            <span className="text-amber-500 font-semibold">Note: </span>
            {provenance.reason}
          </div>
        )}
      </div>
    </div>
  );
}

export function LegendTooltip({
  label,
  definition,
  children,
  position = 'top',
  className,
  badge,
}: LegendTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const tooltipId = useId();
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const triggerRect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const PADDING = 12;

    const targetWidth = Math.min(296, Math.max(260, viewportWidth - PADDING * 2));
    const measuredHeight = tooltipRef.current ? tooltipRef.current.offsetHeight : 140;

    // Center horizontally on trigger, then strictly clamp within viewport
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const idealLeft = triggerCenterX - targetWidth / 2;
    const left = Math.max(PADDING, Math.min(idealLeft, viewportWidth - targetWidth - PADDING));

    // Calculate vertical placement with intelligent flip
    let top: number;
    const spaceAbove = triggerRect.top;
    const spaceBelow = viewportHeight - triggerRect.bottom;

    if (position === 'top') {
      if (spaceAbove < measuredHeight + 10 && spaceBelow > spaceAbove) {
        top = triggerRect.bottom + 8;
      } else {
        top = triggerRect.top - measuredHeight - 8;
      }
    } else if (position === 'bottom') {
      if (spaceBelow < measuredHeight + 10 && spaceAbove > spaceBelow) {
        top = triggerRect.top - measuredHeight - 8;
      } else {
        top = triggerRect.bottom + 8;
      }
    } else {
      top = triggerRect.top + triggerRect.height / 2 - measuredHeight / 2;
    }

    // Clamp top within viewport
    top = Math.max(PADDING, Math.min(top, viewportHeight - measuredHeight - PADDING));

    setCoords({ top, left, width: targetWidth });
  }, [position]);

  // Recalculate position when opened and when element mounts
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  // Re-adjust on scroll or resize
  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => {
      updatePosition();
    };
    window.addEventListener('scroll', handleUpdate, { passive: true, capture: true });
    window.addEventListener('resize', handleUpdate, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, updatePosition]);

  // Desktop hover handlers
  const handleMouseEnter = () => setIsOpen(true);
  const handleMouseLeave = () => setIsOpen(false);

  // Touch long-press handlers (for mobile/tablet)
  const handleTouchStart = () => {
    touchTimerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 320);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchCancel = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Close when tapping outside on touch devices
  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('touchstart', handleDocumentClick);
    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('touchstart', handleDocumentClick);
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [isOpen]);

  const isBadgeAlert =
    badge &&
    (badge.toLowerCase().includes('danger') ||
      badge.toLowerCase().includes('unavail') ||
      badge.toLowerCase().includes('fail') ||
      badge.toLowerCase().includes('err'));

  const isBadgeWarn =
    badge &&
    (badge.toLowerCase().includes('warn') ||
      badge.toLowerCase().includes('stale') ||
      badge.toLowerCase().includes('load'));

  const isBadgePositive =
    badge &&
    (badge.toLowerCase().includes('measur') ||
      badge.toLowerCase().includes('safe') ||
      badge.toLowerCase().includes('live'));

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label={label}
      aria-describedby={isOpen ? tooltipId : undefined}
      className={clsx('relative inline-flex items-center', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setIsOpen(false);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {children}
      {isOpen &&
        mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={tooltipId}
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${coords?.top ?? 0}px`,
              left: `${coords?.left ?? 0}px`,
              width: `${coords?.width ?? 296}px`,
              maxWidth: 'calc(100vw - 24px)',
              zIndex: 99999,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="p-3 bg-[#0a0e1a]/98 border border-slate-700/90 rounded-lg shadow-2xl backdrop-blur-md pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/90">
              <span className="text-xs font-bold text-slate-100 tracking-tight font-sans truncate">
                {label}
              </span>
              {badge && (
                <span
                  className={clsx(
                    'text-[9px] uppercase font-mono px-1.5 py-0.5 rounded font-semibold tracking-wider border shrink-0',
                    isBadgeAlert
                      ? 'bg-rose-950/80 border-rose-800/80 text-rose-300'
                      : isBadgeWarn
                      ? 'bg-amber-950/80 border-amber-800/80 text-amber-300'
                      : isBadgePositive
                      ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300'
                      : 'bg-sky-950/80 border-sky-800/80 text-sky-300'
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
            {renderDefinitionContent(definition)}
          </div>,
          document.body
        )}
    </div>
  );
}
