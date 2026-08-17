import React, { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
}

export interface SelectProps {
  options?: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function Select({
  options = [],
  value,
  onChange,
  onValueChange,
  placeholder = 'Select option...',
  className,
  disabled = false,
  children
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const handleSelect = onChange || onValueChange || (() => {});

  if (children) {
    return <div className={clsx('relative inline-block text-left font-numeric text-xs', className)}>{children}</div>;
  }

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={clsx('relative w-full select-none', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-lg border border-sentinel-700 bg-sentinel-950/80 px-3 py-2 text-xs font-medium text-slate-100 transition focus:border-sentinel-500 focus:outline-none disabled:opacity-50"
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={clsx('h-3.5 w-3.5 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute z-40 mt-1 w-full rounded-lg border border-sentinel-700 bg-sentinel-900 p-1 shadow-xl max-h-48 overflow-y-auto font-mono text-xs">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  handleSelect(opt.value);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center justify-between rounded-md px-2.5 py-1.5 transition text-left',
                  opt.value === value ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-300 hover:bg-sentinel-800'
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="h-3.5 w-3.5 text-sky-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


export interface MultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = 'Select multiple...', className }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  return (
    <div className={clsx('relative w-full select-none', className)}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex flex-wrap items-center gap-1 min-h-[36px] rounded-lg border border-sentinel-700 bg-sentinel-950/80 p-1.5 text-xs text-slate-100 cursor-pointer"
      >
        {value.length === 0 ? (
          <span className="text-slate-500 px-1">{placeholder}</span>
        ) : (
          value.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <span
                key={val}
                className="inline-flex items-center gap-1 rounded bg-sentinel-800 px-2 py-0.5 text-2xs font-mono text-sky-300 border border-sentinel-700"
              >
                {opt?.label || val}
                <X
                  className="h-3 w-3 hover:text-rose-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(val);
                  }}
                />
              </span>
            );
          })
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute z-40 mt-1 w-full rounded-lg border border-sentinel-700 bg-sentinel-900 p-1 shadow-xl max-h-48 overflow-y-auto font-mono text-xs">
            {options.map((opt) => {
              const isSelected = value.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  className={clsx(
                    'w-full flex items-center justify-between rounded-md px-2.5 py-1.5 transition text-left cursor-pointer',
                    isSelected ? 'bg-sentinel-800 text-sky-300 font-bold' : 'text-slate-300 hover:bg-sentinel-850'
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-sky-400" />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function SelectTrigger({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('inline-flex items-center justify-between rounded-lg border border-sentinel-700 bg-sentinel-950 px-3 py-2 text-xs font-medium text-slate-100', className)} {...props}>{children}</div>;
}

export function SelectValue({ children }: { children?: React.ReactNode }) {
  return <span>{children}</span>;
}

export function SelectContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('rounded-lg border border-sentinel-700 bg-sentinel-900 p-1 shadow-xl text-xs', className)} {...props}>{children}</div>;
}

export function SelectItem({ value, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  return <div className={clsx('rounded-md px-2.5 py-1.5 transition text-left cursor-pointer text-slate-300 hover:bg-sentinel-800', className)} {...props}>{children}</div>;
}

