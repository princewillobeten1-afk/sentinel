'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Send, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { WebhookCreateDialog } from './webhook-create-dialog';
import { SecretRevealPanel } from './secret-reveal-panel';
import type { WebhookEventType } from '@/lib/webhooks/store';

interface WebhookSummary {
  id: string;
  url: string;
  eventTypes: WebhookEventType[];
  status: 'active' | 'disabled';
  createdAt: string;
}

export function WebhookList() {
  const [webhooks, setWebhooks] = useState<WebhookSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ label: string; secret: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WebhookSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testResultId, setTestResultId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/webhooks');
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to load webhooks');
      setWebhooks(payload.data.webhooks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTest = async (webhook: WebhookSummary) => {
    setBusyId(webhook.id);
    try {
      const res = await fetch(`/api/v1/webhooks/${webhook.id}/test`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to queue test event');
      setTestResultId(webhook.id);
      setTimeout(() => setTestResultId(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue test event');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      const res = await fetch(`/api/v1/webhooks/${pendingDelete.id}`, { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to delete webhook');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <WebhookIcon className="h-4 w-4 text-sky-400" /> Webhooks
          </span>
        }
        subtitle="HMAC-signed event delivery with automatic retry (1m / 5m / 30m / 2h backoff)."
        headerActions={
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            Create Webhook
          </Button>
        }
      >
        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

        {webhooks === null && !error && <p className="text-xs text-slate-500">Loading…</p>}

        {webhooks !== null && webhooks.length === 0 && (
          <EmptyState
            icon={WebhookIcon}
            title="No webhooks yet"
            description="Register a URL to receive real-time events like exitability drops or risk changes as signed HTTP POSTs."
            actionLabel="Create Webhook"
            onAction={() => setCreateOpen(true)}
          />
        )}

        {webhooks !== null && webhooks.length > 0 && (
          <div className="space-y-2">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-sentinel-800 bg-sentinel-900/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono text-slate-100 truncate max-w-xs">{webhook.url}</span>
                    <Badge variant={webhook.status === 'active' ? 'success' : 'neutral'} size="sm">
                      {webhook.status}
                    </Badge>
                    {testResultId === webhook.id && (
                      <Badge variant="info" size="sm">
                        test queued
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {webhook.eventTypes.map((type) => (
                      <Badge key={type} variant="mono" size="sm">
                        {type}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-2xs text-slate-500 mt-1.5">Created {new Date(webhook.createdAt).toLocaleDateString()}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Send className="h-3.5 w-3.5" />}
                    isLoading={busyId === webhook.id}
                    onClick={() => handleTest(webhook)}
                  >
                    Test
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    isLoading={busyId === webhook.id}
                    onClick={() => setPendingDelete(webhook)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <WebhookCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(secret, url) => {
          setCreateOpen(false);
          setRevealedSecret({ label: `${url} — signing secret`, secret });
          load();
        }}
      />

      {revealedSecret && (
        <SecretRevealPanel
          label={revealedSecret.label}
          secret={revealedSecret.secret}
          onDismiss={() => setRevealedSecret(null)}
        />
      )}

      <ConfirmationDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete webhook?"
        description={`Deliveries to "${pendingDelete?.url}" will stop immediately. This cannot be undone.`}
        confirmLabel="Delete Webhook"
        isLoading={busyId === pendingDelete?.id}
      />
    </div>
  );
}
