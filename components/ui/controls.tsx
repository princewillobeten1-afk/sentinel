import React from 'react';
import { clsx } from 'clsx';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled = false, className }: ToggleProps) {
  return (
    <label className={clsx('inline-flex items-center gap-2 select-none cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none p-0.5',
          checked ? 'bg-emerald-500' : 'bg-sentinel-800 border border-sentinel-700'
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-slate-950 transition-transform duration-200 shadow',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
      {label && <span className="text-xs text-slate-300 font-medium">{label}</span>}
    </label>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onChange, label, disabled = false, className }: CheckboxProps) {
  return (
    <label className={clsx('inline-flex items-center gap-2 select-none cursor-pointer text-xs text-slate-300', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-sentinel-700 bg-sentinel-950 text-sky-500 focus:ring-sky-400 focus:ring-offset-sentinel-950"
      />
      {label && <span>{label}</span>}
    </label>
  );
}

export interface RadioGroupProps {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function RadioGroup({ options, value, onChange, className }: RadioGroupProps) {
  return (
    <div className={clsx('space-y-2 select-none', className)}>
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="radio"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="h-4 w-4 border-sentinel-700 bg-sentinel-950 text-sky-500 focus:ring-sky-400"
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function Slider({ min = 0, max = 100, step = 1, value, onChange, className }: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={clsx('w-full accent-sky-400 bg-sentinel-800 h-1.5 rounded-lg cursor-pointer', className)}
    />
  );
}
