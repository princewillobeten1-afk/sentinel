import React from 'react';
import { clsx } from 'clsx';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const alertStyles = {
  info: 'border-sky-500/40 bg-sky-950/20 text-sky-300',
  warning: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
  error: 'border-rose-500/40 bg-rose-950/20 text-rose-300',
  success: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
};

const icons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
};

export function Alert({ variant = 'info', title, children, onDismiss, className }: AlertProps) {
  const IconComponent = icons[variant];

  return (
    <div className={clsx('relative rounded-xl border p-4 shadow-sm text-xs flex items-start gap-3', alertStyles[variant], className)}>
      <IconComponent className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-bold text-sm text-white">{title}</h5>}
        <div className="leading-relaxed text-slate-200">{children}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="p-1 text-slate-400 hover:text-white transition">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={clsx("font-bold text-sm text-white", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("leading-relaxed text-slate-200", className)} {...props} />;
}
