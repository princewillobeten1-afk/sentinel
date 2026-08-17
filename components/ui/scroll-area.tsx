import React from 'react';
import { clsx } from 'clsx';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  return (
    <div className={clsx('overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-sentinel-700', className)} {...props}>
      {children}
    </div>
  );
}
