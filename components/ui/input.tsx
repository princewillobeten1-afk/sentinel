import React from 'react';
import { clsx } from 'clsx';
import { Search, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  isMonospace?: boolean;
  onClear?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftAddon, rightAddon, isMonospace = false, onClear, value, type = 'text', ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftAddon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-sentinel-400">
            {leftAddon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          value={value}
          className={clsx(
            // Inputs read as recessed — a well cut into the surface — so an
            // editable field is distinguishable from a card at a glance.
            'w-full rounded-md border border-sentinel-700 bg-sentinel-900 px-3 h-9 text-xs text-sentinel-100',
            'placeholder:text-sentinel-500',
            'transition-colors duration-100',
            'hover:border-sentinel-600',
            'focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/60',
            'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-rose-400',
            leftAddon && 'pl-9',
            (rightAddon || onClear) && 'pr-9',
            isMonospace && 'font-numeric',
            className
          )}
          {...props}
        />
        {onClear && value && (
          <button
            type="button"
            aria-label="Clear input"
            onClick={onClear}
            className="absolute right-2.5 p-1 text-sentinel-400 hover:text-sentinel-100 transition-colors rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {rightAddon && !onClear && (
          <div className="absolute right-3 flex items-center pointer-events-none text-sentinel-400">
            {rightAddon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export function SearchInput({ className, value, onChange, onClear, placeholder = 'Search tokens, wallets, mints...', ...props }: InputProps) {
  return (
    <Input
      leftAddon={<Search className="h-4 w-4" />}
      value={value}
      onChange={onChange}
      onClear={onClear}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
}
