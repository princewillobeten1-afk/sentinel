import React from 'react';
import { clsx } from 'clsx';

function cn(...inputs: Array<string | undefined | null | false>) {
  return clsx(inputs);
}

export type PhivexLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const MARK_SIZE_CLASS: Record<PhivexLogoSize, string> = {
  xs: 'h-6 w-6 rounded-md',
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-11 w-11 rounded-xl',
  xl: 'h-14 w-14 rounded-2xl',
};

export interface PhivexLogoMarkProps {
  size?: PhivexLogoSize;
  className?: string;
}

/** Official 3D orbital P emblem for compact headers, sidebars, and badges. */
export function PhivexLogoMark({ size = 'sm', className }: PhivexLogoMarkProps) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#050810] border border-indigo-400/25 shadow-[0_0_16px_rgba(99,102,241,0.22)] transition-transform duration-200',
        MARK_SIZE_CLASS[size],
        className,
      )}
    >
      <img
        src="/brand/phivex-mark.png"
        alt="Phivex"
        decoding="async"
        className="h-[84%] w-[84%] object-contain select-none pointer-events-none"
      />
    </span>
  );
}

export interface PhivexLockupProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const LOCKUP_WIDTH_CLASS = {
  sm: 'w-32',
  md: 'w-44',
  lg: 'w-56',
};

/** Full stacked PHIVEX — INTELLIGENCE FIRST brand lockup for auth & hero surfaces. */
export function PhivexLogoLockup({ className, size = 'md' }: PhivexLockupProps) {
  return (
    <div className={cn('inline-flex items-center justify-center', className)}>
      <img
        src="/brand/phivex-lockup.png"
        alt="PHIVEX — Intelligence First"
        decoding="async"
        className={cn('h-auto object-contain select-none pointer-events-none', LOCKUP_WIDTH_CLASS[size])}
      />
    </div>
  );
}
