import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

import Link from 'next/link';

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
  href?: string;
  prefetch?: boolean;
  target?: string;
  rel?: string;
}

export const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#415CF2] text-white font-semibold border border-[#6683FF]/50 hover:bg-[#526FFF] hover:border-[#8EA2FF]/60 active:bg-[#364FD9] shadow-[0_0_12px_rgba(65,92,242,0.32)]',
  default:
    'bg-[#415CF2] text-white font-semibold border border-[#6683FF]/50 hover:bg-[#526FFF] hover:border-[#8EA2FF]/60 active:bg-[#364FD9]',

  secondary:
    'bg-[#151821] text-[#F7F8F9] border border-[#222634] hover:bg-[#1C202B] hover:border-[#32374A] active:bg-[#11141B]',

  buy:
    'bg-[#2FE3AC] text-[#04130E] font-bold border border-[#2FE3AC] hover:bg-[#6FF3C8] hover:border-[#6FF3C8] active:bg-[#12AF80] shadow-[0_0_12px_rgba(47,227,172,0.24)]',
  sell:
    'bg-[#EC397A] text-white font-bold border border-[#EC397A] hover:bg-[#FF6166] hover:border-[#FF6166] active:bg-[#D12665] shadow-[0_0_12px_rgba(236,57,122,0.24)]',

  outline:
    'bg-[#11141B] text-[#C8C9D1] border border-[#1E222D] hover:border-[#526FFF]/50 hover:bg-[#151821] hover:text-[#F7F8F9] active:bg-[#1C202B]',
  ghost:
    'bg-transparent text-[#828598] border border-transparent hover:bg-white/[0.04] hover:text-[#F7F8F9] active:bg-[#1C202B]',

  glass:
    'bg-[#0D1015]/80 backdrop-blur-md text-[#F7F8F9] border border-[#222634] hover:bg-[#151821] hover:border-[#526FFF]/40 shadow-glass',

  destructive:
    'bg-[#EC397A] text-white font-bold border border-[#EC397A] hover:bg-[#FF6166]',
  danger:
    'bg-[#EC397A] text-white font-bold border border-[#EC397A] hover:bg-[#FF6166]',

  cyber:
    'bg-[#526FFF]/15 text-[#8EA2FF] font-semibold border border-[#526FFF]/35 hover:border-[#6683FF] hover:bg-[#526FFF]/25 hover:text-white shadow-[0_0_12px_rgba(82,111,255,0.22)]',
};

export const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-2xs rounded-md gap-1',
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-3.5 text-xs rounded-md gap-1.5',
  lg: 'h-11 px-5 text-sm rounded-md gap-2',
  icon: 'h-9 w-9 p-0 rounded-md gap-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      href,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const classes = clsx(
      'inline-flex items-center justify-center whitespace-nowrap font-medium',
      'transition-all duration-150 select-none active:scale-[0.98]',
      'focus:outline-none focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:outline-offset-2',
      (disabled || isLoading) && 'disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none',
      variantStyles[variant],
      sizeStyles[size],
      className
    );

    if (href) {
      return (
        <Link
          href={href}
          prefetch={props.prefetch}
          target={props.target}
          rel={props.rel}
          className={classes}
          onClick={props.onClick as any}
          data-ui="button"
        >
          {isLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
          )}
          {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        data-ui="button"
        className={classes}
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

