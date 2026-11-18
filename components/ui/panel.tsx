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
  default: 'bg-[#0D1015] border border-[#1E222D]',
  subtle: 'bg-[#0D1015]/80 border border-[#1E222D] shadow-sm',
  inset: 'bg-[#080A0F] border border-[#1E222D] shadow-inner',
  bordered: 'bg-transparent border border-[#1E222D]',
  glass: 'bg-[#0D1015]/90 border border-[#1E222D] backdrop-blur-md',
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
    <div data-ui="panel" className={clsx('min-w-0 rounded-[8px] overflow-hidden flex flex-col', variantStyles[variant], className)} {...props}>
      {(title || subtitle || headerActions) && (
        <div data-ui="panel-header" className="flex items-center justify-between border-b border-[#1E222D] px-4 py-2.5 bg-[#10131A]/95 backdrop-blur-md">
          <div className="min-w-0">
            {title && (
              <div data-ui="panel-title" className="text-xs sm:text-sm font-semibold text-[#F7F8F9] flex items-center gap-2">
                {title}
              </div>
            )}
            {subtitle && <p className="text-[11px] text-[#828598] mt-0.5">{subtitle}</p>}
          </div>
          {headerActions && <div data-ui="panel-actions" className="flex items-center gap-2 shrink-0">{headerActions}</div>}
        </div>
      )}
      <div className={clsx('min-w-0 flex-1', paddingStyles[padding])}>{children}</div>
      {footer && <div className="border-t border-[#1E222D] bg-[#0A0D12] px-4 py-2 text-xs text-[#828598]">{footer}</div>}
    </div>
  );
}
