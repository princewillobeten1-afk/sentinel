import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  position?: 'right' | 'left' | 'bottom';
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  position = 'right',
  children,
  footer,
  className,
}: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyles = {
    right: 'inset-y-0 right-0 max-w-md w-full animate-in slide-in-from-right duration-200',
    left: 'inset-y-0 left-0 max-w-md w-full animate-in slide-in-from-left duration-200',
    bottom: 'inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl animate-in slide-in-from-bottom duration-200',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-200"
      />

      <div
        className={clsx(
          'fixed flex flex-col bg-sentinel-900 border-sentinel-700 shadow-2xl z-10 overflow-hidden',
          position === 'right' && 'border-l',
          position === 'left' && 'border-r',
          position === 'bottom' && 'border-t',
          positionStyles[position],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sentinel-700/70 px-5 py-4 bg-sentinel-950/70">
          <div>
            {title && <h3 className="text-base font-semibold text-white flex items-center gap-2">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-sentinel-800 hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-sentinel-700/70 p-4 bg-sentinel-950/70">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
