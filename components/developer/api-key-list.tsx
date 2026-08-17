'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Key, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ApiKeyCreateDialog } from './api-key-create-dialog';
import { SecretRevealPanel } from './secret-reveal-panel';

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  environment: 'production' | 'sandbox';
  scopes: string[];
  tier: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export function ApiKeyList() {
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ label: string; secret: string } | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKeySummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/user/api-keys');
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to load API keys');
      setKeys(payload.data.keys);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRotate = async (key: ApiKeySummary) => {
    setBusyId(key.id);
    try {
      const res = await fetch(`/api/v1/user/api-keys/${key.id}/rotate`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to rotate key');
      setRevealedSecret({ label: `${key.name} — new secret`, secret: payload.data.secret });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate key');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async () => {
    if (!pendingRevoke) return;
    setBusyId(pendingRevoke.id);
    try {
      const res = await fetch(`/api/v1/user/api-keys/${pendingRevoke.id}`, { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to revoke key');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    } finally {
      setBusyId(null);
      setPendingRevoke(null);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Key className="h-4 w-4 text-sky-400" /> API Keys
          </span>
        }
        subtitle="Scoped credentials for programmatic access. Secrets are shown exactly once."
        headerActions={
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            Create Key
          </Button>
        }
      >
        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

        {keys === null && !error && <p className="text-xs text-slate-500">Loading…</p>}

        {keys !== null && keys.length === 0 && (
          <EmptyState
            icon={Key}
            title="No API keys yet"
            description="Create a key to authenticate SDK/API requests. Each key carries its own scopes, tier and environment."
            actionLabel="Create Key"
            onAction={() => setCreateOpen(true)}
          />
        )}

        {keys !== null && keys.length > 0 && (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-sentinel-800 bg-sentinel-900/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-100">{key.name}</span>
                    <Badge variant={key.status === 'active' ? 'success' : 'neutral'} size="sm">
                      {key.status}
                    </Badge>
                    <Badge variant={key.environment === 'production' ? 'warning' : 'info'} size="sm">
                      {key.environment}
                    </Badge>
                    <Badge variant="secondary" size="sm">
                      {key.tier}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-1">{key.keyPrefix}••••••••••••••••</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="mono" size="sm">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-2xs text-slate-500 mt-1.5">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleString()}` : ' · never used'}
                  </p>
                </div>

                {key.status === 'active' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<RotateCw className="h-3.5 w-3.5" />}
                      isLoading={busyId === key.id}
                      onClick={() => handleRotate(key)}
                    >
                      Rotate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      isLoading={busyId === key.id}
                      onClick={() => setPendingRevoke(key)}
                    >
                      Revoke
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <ApiKeyCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(secret, name) => {
          setCreateOpen(false);
          setRevealedSecret({ label: `${name} — secret`, secret });
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
        isOpen={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        onConfirm={handleRevoke}
        title="Revoke API key?"
        description={`"${pendingRevoke?.name}" will stop working immediately. Any integration using it will start receiving 401s. This cannot be undone.`}
        confirmLabel="Revoke Key"
        isLoading={busyId === pendingRevoke?.id}
      />
    </div>
  );
}
