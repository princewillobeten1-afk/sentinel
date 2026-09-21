import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'buy'
  | 'sell'
  | 'outline'
  | 'ghost'
  | 'glass'
  | 'destructive'
  | 'danger'
  | 'cyber'
  | 'default';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-sky-400 text-slate-950 font-semibold border border-sky-400 hover:bg-sky-300 hover:border-sky-300 active:bg-sky-500',
  default:
    'bg-sky-400 text-slate-950 font-semibold border border-sky-400 hover:bg-sky-300 hover:border-sky-300 active:bg-sky-500',

  secondary:
    'bg-sentinel-800 text-slate-200 border border-sentinel-700/80 hover:bg-sentinel-750 hover:border-sentinel-600 hover:text-white active:bg-sentinel-850',

  buy:
    'bg-emerald-400 text-slate-950 font-semibold border border-emerald-400 hover:bg-emerald-300 hover:border-emerald-300 active:bg-emerald-500',
  sell:
    'bg-rose-400 text-slate-950 font-semibold border border-rose-400 hover:bg-rose-300 hover:border-rose-300 active:bg-rose-500',

  outline:
    'bg-transparent text-slate-200 border border-sentinel-700 hover:border-sky-500/50 hover:bg-sentinel-800 hover:text-white active:bg-sentinel-750',
  ghost:
    'bg-transparent text-slate-400 border border-transparent hover:bg-sentinel-800/80 hover:text-slate-100 active:bg-sentinel-750',

  glass:
    'bg-sentinel-900/60 backdrop-blur-md text-slate-200 border border-white/[0.08] hover:bg-sentinel-800/80 hover:border-sky-500/40 hover:text-white shadow-glass',

  destructive:
    'bg-rose-500 text-white font-bold border border-rose-500 hover:bg-rose-400',
  danger:
    'bg-rose-500 text-white font-bold border border-rose-500 hover:bg-rose-400',

  cyber:
    'bg-sky-500/10 text-sky-300 font-semibold border border-sky-500/30 hover:border-sky-400 hover:bg-sky-500/20 hover:text-white shadow-[0_0_10px_rgba(0,240,255,0.2)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-2xs rounded-md gap-1',
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-3.5 text-xs rounded-md gap-1.5',
  lg: 'h-11 px-5 text-sm rounded-md gap-2',
  icon: 'h-9 w-9 p-0 rounded-md gap-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        data-ui="button"
        className={clsx(
          'inline-flex items-center justify-center whitespace-nowrap font-medium',
          'transition-all duration-150 select-none active:scale-[0.98]',
          'focus:outline-none focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {isLoading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
        )}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
