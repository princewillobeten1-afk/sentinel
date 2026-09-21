import React from 'react';
import { clsx } from 'clsx';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  count?: number | string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'segmented' | 'underline' | 'pills';
  size?: 'sm' | 'md';
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, variant = 'segmented', size = 'md', className }: TabsProps) {
  if (variant === 'segmented') {
    return (
      <div data-ui="tabs" className={clsx('inline-flex max-w-full overflow-x-auto items-center rounded-md bg-sentinel-950 p-1 border border-sentinel-800 select-none', className)}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(tab.id)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md transition-all font-medium',
                size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm',
                isActive
                  ? 'bg-sky-500/10 text-sky-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
              )}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.2 text-2xs font-mono',
                    isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-sentinel-800 text-slate-400'
                  )}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div data-ui="tabs" className={clsx('flex max-w-full overflow-x-auto border-b border-sentinel-700/70 space-x-4 select-none', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'inline-flex items-center gap-2 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px',
              isActive
                ? 'border-sentinel-500 text-sky-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-sentinel-700'
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="rounded-md bg-sentinel-800 px-1.5 py-0.5 text-2xs font-mono text-slate-300">
                {tab.count}
              </span>
            )}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
