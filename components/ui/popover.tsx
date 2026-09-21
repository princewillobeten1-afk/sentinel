'use client';

import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';

export interface PopoverProps {
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'end' | 'start';
  className?: string;
}

const PopoverContext = createContext<{ open: boolean; setOpen: (value: boolean) => void; id: string } | null>(null);

export function Popover({ trigger, children, align = 'right', className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && root.current?.contains(document.activeElement)) {
        event.preventDefault(); event.stopPropagation(); setOpen(false);
        root.current.querySelector<HTMLElement>('[data-popover-trigger]')?.focus();
      }
    };
    const element = root.current;
    document.addEventListener('pointerdown', outside);
    element?.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      element?.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <PopoverContext.Provider value={{ open, setOpen, id }}>
      <div ref={root} className="relative inline-block max-w-full text-left" onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
      }}>
        {trigger ? <><PopoverTrigger asChild>{trigger}</PopoverTrigger><PopoverContent align={align} className={className}>{children}</PopoverContent></> : children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({ children, asChild, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const context = useContext(PopoverContext);
  if (!context) return null;
  const child = asChild && React.isValidElement(children) ? children as React.ReactElement<React.HTMLAttributes<HTMLElement>> : null;
  // Custom controls (including our forwarded Button) retain native key handling.
  const nativeButton = Boolean(child && (typeof child.type !== 'string' || child.type === 'button' || child.type === 'a'));
  const triggerProps = {
    ...props,
    'data-popover-trigger': '',
    'aria-expanded': context.open,
    'aria-controls': context.open ? context.id : undefined,
    role: nativeButton ? undefined : 'button',
    tabIndex: nativeButton ? undefined : 0,
    className: clsx('cursor-pointer inline-flex', child?.props.className, className),
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      child?.props.onClick?.(event);
      if (!event.defaultPrevented) context.setOpen(!context.open);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      child?.props.onKeyDown?.(event);
      if (!nativeButton && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); context.setOpen(!context.open);
      }
    },
  };
  return child ? React.cloneElement(child, triggerProps) : <div {...triggerProps}>{children}</div>;
}

export function PopoverContent({ children, className, align = 'end', ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' | 'left' | 'right' }) {
  const context = useContext(PopoverContext);
  if (!context?.open) return null;
  return (
    <div
      id={context.id}
      className={clsx(
        'absolute z-50 mt-2 max-w-[calc(100vw-2rem)] max-h-[70dvh] overflow-y-auto rounded-lg border border-sentinel-700 bg-sentinel-900 p-3 shadow-xl text-xs',
        align === 'end' || align === 'right' ? 'right-0' : 'left-0',
        className
      )}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if ((event.target as HTMLElement).closest('a[href]')) context.setOpen(false);
      }}
    >
      {children}
    </div>
  );
}
