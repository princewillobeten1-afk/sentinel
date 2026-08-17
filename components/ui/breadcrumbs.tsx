import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { clsx } from 'clsx';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={clsx('flex items-center gap-1.5 text-xs text-slate-400 font-mono select-none', className)}>
      <Home className="h-3.5 w-3.5 text-slate-500" />
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span
              onClick={item.onClick}
              className={clsx(
                'transition-colors',
                isLast ? 'text-sky-400 font-bold' : 'hover:text-slate-200 cursor-pointer'
              )}
            >
              {item.label}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
