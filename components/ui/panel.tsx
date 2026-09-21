import React from 'react';
import { clsx } from 'clsx';

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'subtle' | 'inset' | 'bordered' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-6',
};

const variantStyles = {
  default: 'bg-sentinel-900 border border-sentinel-700/60',
  subtle: 'bg-sentinel-900/70 border border-sentinel-800 shadow-sm',
  inset: 'bg-sentinel-950/80 border border-sentinel-800/90 shadow-inner',
  bordered: 'bg-transparent border border-sentinel-700',
  glass: 'bg-sentinel-900 border border-sentinel-700/60',
};

export function Panel({
  className,
  title,
  subtitle,
  headerActions,
  footer,
  variant = 'default',
  padding = 'md',
  children,
  ...props
}: PanelProps) {
  return (
    <div data-ui="panel" className={clsx('min-w-0 rounded-lg overflow-hidden flex flex-col', variantStyles[variant], className)} {...props}>
      {(title || subtitle || headerActions) && (
        <div data-ui="panel-header" className="flex items-center justify-between border-b border-sentinel-700/60 px-4 py-2.5 bg-sentinel-900/50 backdrop-blur-md">
          <div className="min-w-0">
            {title && (
              <div data-ui="panel-title" className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                {title}
              </div>
            )}
            {subtitle && <p className="text-2xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {headerActions && <div data-ui="panel-actions" className="flex items-center gap-2 shrink-0">{headerActions}</div>}
        </div>
      )}
      <div className={clsx('min-w-0 flex-1', paddingStyles[padding])}>{children}</div>
      {footer && <div className="border-t border-sentinel-700/60 bg-sentinel-900/40 px-4 py-2 text-xs text-slate-400">{footer}</div>}
    </div>
  );
}
