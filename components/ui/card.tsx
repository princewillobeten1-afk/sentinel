import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'inset' | 'glass';
  interactive?: boolean;
}

const variantClasses = {
  default: 'bg-sentinel-800/90 border border-sentinel-700/80 shadow-card backdrop-blur-md',
  subtle: 'bg-sentinel-850/80 border border-sentinel-700/60 shadow-sm backdrop-blur-sm',
  inset: 'bg-sentinel-950/80 border border-sentinel-800 shadow-inner',
  glass: 'bg-sentinel-900/60 border border-white/[0.08] shadow-glass backdrop-blur-xl',
};

export function Card({ className, variant = 'default', interactive = false, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl p-4 transition-all duration-200',
        variantClasses[variant],
        interactive &&
          'hover:border-sky-500/40 hover:bg-sentinel-750/90 hover:shadow-card-lift cursor-pointer hover:-translate-y-0.5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('flex flex-col gap-1 pb-3', className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={clsx('text-sm font-bold text-slate-100 leading-snug tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx('text-xs text-slate-400 leading-relaxed', className)} {...props}>{children}</p>;
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('pt-0', className)} {...props}>{children}</div>;
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('flex items-center pt-3 mt-3 border-t border-sentinel-700/60', className)} {...props}>{children}</div>;
}
