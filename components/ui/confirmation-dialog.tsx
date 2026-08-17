import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'destructive' | 'primary' | 'buy' | 'sell';
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm Action',
  confirmVariant = 'destructive',
  isLoading = false,
}: ConfirmationDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2 text-rose-400">
          <AlertTriangle className="h-5 w-5" /> {title}
        </span>
      }
      footer={
        <div className="flex items-center gap-2 w-full justify-end">
          <Button onClick={onClose} variant="ghost" size="sm">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant={confirmVariant} size="sm" isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-xs text-slate-300 leading-relaxed font-sans">{description}</p>
    </Modal>
  );
}
