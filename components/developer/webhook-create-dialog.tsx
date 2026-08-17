'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WebhookEventType } from '@/lib/webhooks/store';

export interface WebhookCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (secret: string, url: string) => void;
}

/** Mirrors the closed enum in `lib/webhooks/store.ts` — hardcoded here rather than imported so this client component never pulls that module's `node:crypto` dependency into the browser bundle. */
const EVENT_TYPES: WebhookEventType[] = [
  'token.risk_changed',
  'token.insider_detected',
  'token.liquidity_changed',
  'token.exitability_dropped',
  'wallet.activity',
  'launch.created',
  'launch.graduated',
  'order.filled',
  'order.failed',
];

export function WebhookCreateDialog({ isOpen, onClose, onCreated }: WebhookCreateDialogProps) {
  const [url, setUrl] = useState('');
  const [eventTypes, setEventTypes] = useState<Set<WebhookEventType>>(new Set());
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (type: WebhookEventType) => {
    setEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const reset = () => {
    setUrl('');
    setEventTypes(new Set());
    setError(null);
  };

  const handleSubmit = async () => {
    if (!url.trim()) {
      setError('A destination URL is required.');
      return;
    }
    if (eventTypes.size === 0) {
      setError('Subscribe to at least one event type.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), eventTypes: [...eventTypes] }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to create webhook');

      const createdUrl = url.trim();
      reset();
      onCreated(payload.data.secret, createdUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      size="lg"
      title="Create Webhook"
      subtitle="Events are delivered as an HMAC-SHA256-signed POST — see docs/api/webhooks.md."
      footer={
        <div className="flex items-center gap-2 w-full justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} isLoading={isSubmitting}>
            Create Webhook
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 block">Destination URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-service.com/webhooks/sentinel"
            isMonospace
          />
          <p className="text-2xs text-slate-500 mt-1">https required (http allowed only for localhost testing).</p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-300 mb-2 block">Event types</label>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_TYPES.map((type) => {
              const checked = eventTypes.has(type);
              return (
                <label
                  key={type}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-mono cursor-pointer transition ${
                    checked
                      ? 'border-sky-600/50 bg-sky-950/20 text-sky-300'
                      : 'border-sentinel-800 bg-sentinel-900/50 text-slate-400 hover:border-sentinel-700'
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(type)} className="accent-sky-500" />
                  {type}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
