import React, { useState } from 'react';
import { clsx } from 'clsx';

export interface PopoverProps {
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'end' | 'start';
  className?: string;
}

export function Popover({ trigger, children, align = 'right', className }: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  // If trigger prop is provided (simple mode)
  if (trigger) {
    return (
      <div className="relative inline-block text-left">
        <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
          {trigger}
        </div>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div
              className={clsx(
                'absolute z-50 mt-2 rounded-xl border border-sentinel-700 bg-sentinel-900 p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150',
                align === 'right' || align === 'end' ? 'right-0' : 'left-0',
                className
              )}
            >
              {children}
            </div>
          </>
        )}
      </div>
    );
  }

  // Compound mode (PopoverTrigger & PopoverContent)
  return <div className="relative inline-block text-left">{children}</div>;
}

export function PopoverTrigger({ children, asChild, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  return (
    <div className={clsx('cursor-pointer inline-block', className)} {...props}>
      {children}
    </div>
  );
}

export function PopoverContent({ children, className, align = 'end', ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' | 'left' | 'right' }) {
  return (
    <div
      className={clsx(
        'absolute z-50 mt-2 rounded-xl border border-sentinel-700 bg-sentinel-900 p-3 shadow-2xl backdrop-blur-md font-numeric text-xs',
        align === 'end' || align === 'right' ? 'right-0' : 'left-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
