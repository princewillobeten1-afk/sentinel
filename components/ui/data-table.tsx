import React from 'react';
import { clsx } from 'clsx';
import { ArrowUpDown, ArrowUp, ArrowDown, Database } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  accessor?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
  isMonospace?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  zebra?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  isLoading = false,
  emptyMessage = 'No data available',
  className,
  zebra = false,
}: DataTableProps<T>) {
  return (
    <div className={clsx('w-full overflow-x-auto rounded-xl border border-white/[0.08] bg-sentinel-900/70 shadow-card backdrop-blur-xl', className)}>
      <table className="w-full text-left text-xs border-collapse">
        <thead className="sticky top-0 z-10 bg-sentinel-950/95 uppercase text-slate-400 font-mono text-[10px] tracking-wider border-b border-white/[0.08] backdrop-blur-md">
          <tr>
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              return (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  className={clsx(
                    'px-3.5 py-2.5 select-none transition-colors font-bold',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.sortable && 'cursor-pointer hover:text-white hover:bg-sentinel-800/60'
                  )}
                >
                  <div className={clsx('inline-flex items-center gap-1.5', col.align === 'right' && 'flex-row-reverse')}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-slate-500">
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-sky-400 drop-shadow-[0_0_4px_rgba(0,240,255,0.4)]" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-sky-400 drop-shadow-[0_0_4px_rgba(0,240,255,0.4)]" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-sentinel-800/50 text-slate-200">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <tr key={idx} className="animate-pulse">
                {columns.map((col) => (
                  <td key={col.key} className="table-cell-density px-3.5 py-3">
                    <div className="h-3.5 w-3/4 rounded bg-sentinel-800/80" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Database className="h-7 w-7 text-slate-600" />
                  <span className="text-xs font-mono">{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={clsx(
                  'transition-all duration-150 hover:bg-sentinel-750/70 group',
                  zebra && rowIdx % 2 === 1 && 'bg-sentinel-950/30',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => {
                  const content = col.accessor
                    ? col.accessor(item)
                    : (item as Record<string, unknown>)[col.key] as React.ReactNode;
                  return (
                    <td
                      key={col.key}
                      className={clsx(
                        'table-cell-density px-3.5 py-2.5 text-slate-200 font-medium whitespace-nowrap',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.isMonospace && 'font-numeric'
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
