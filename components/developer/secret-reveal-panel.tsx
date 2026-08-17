'use client';

import React, { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

export interface SecretRevealPanelProps {
  label: string;
  secret: string;
  onDismiss: () => void;
}

/** Shown exactly once, right after a key/webhook secret is created or rotated — it is never retrievable again. */
export function SecretRevealPanel({ label, secret, onDismiss }: SecretRevealPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the secret is still selectable/visible in the field below.
    }
  };

  return (
    <Modal
      isOpen
      onClose={onDismiss}
      size="md"
      title={
        <span className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-5 w-5" /> Save this secret now
        </span>
      }
      footer={
        <Button onClick={onDismiss} variant="primary" size="sm">
          I've saved it — Close
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-slate-100">{label}</span> — this is shown only once and cannot be
          retrieved later. If you lose it, you'll need to rotate or create a new one.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-sentinel-700 bg-sentinel-950 px-3 py-2 text-xs font-numeric text-sky-300 select-all">
            {secret}
          </code>
          <Button size="sm" variant="outline" onClick={handleCopy} leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
