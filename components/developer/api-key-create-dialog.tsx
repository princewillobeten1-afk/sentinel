'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SCOPES, DANGEROUS_SCOPES, type Scope } from '@/lib/server/scopes';
import { RATE_LIMIT_TIERS } from '@/lib/server/rate-limit-v2';

export interface ApiKeyCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (secret: string, name: string) => void;
}

export function ApiKeyCreateDialog({ isOpen, onClose, onCreated }: ApiKeyCreateDialogProps) {
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('sandbox');
  const [tier, setTier] = useState<(typeof RATE_LIMIT_TIERS)[number]>('FREE');
  const [scopes, setScopes] = useState<Set<Scope>>(new Set());
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { readOnlyScopes, dangerousScopes } = useMemo(
    () => ({
      readOnlyScopes: SCOPES.filter((scope) => !DANGEROUS_SCOPES.has(scope)),
      dangerousScopes: SCOPES.filter((scope) => DANGEROUS_SCOPES.has(scope)),
    }),
    [],
  );

  const toggleScope = (scope: Scope) => {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
        // MANAGE_LAUNCH can't be granted without CREATE_LAUNCH — unchecking the latter drops both.
        if (scope === 'CREATE_LAUNCH') next.delete('MANAGE_LAUNCH');
      } else {
        next.add(scope);
        // Mirrors the server-side rule in lib/server/scopes.ts#assertScopeGrantable.
        if (scope === 'MANAGE_LAUNCH') next.add('CREATE_LAUNCH');
      }
      return next;
    });
  };

  const reset = () => {
    setName('');
    setEnvironment('sandbox');
    setTier('FREE');
    setScopes(new Set());
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Give this key a name so you can recognize it later.');
      return;
    }
    if (scopes.size === 0) {
      setError('Select at least one scope.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), environment, tier, scopes: [...scopes] }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to create key');

      const createdName = name.trim();
      reset();
      onCreated(payload.data.secret, createdName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
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
      title="Create API Key"
      subtitle="Grant only the scopes an integration actually needs."
      footer={
        <div className="flex items-center gap-2 w-full justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} isLoading={isSubmitting}>
            Create Key
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 block">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trading bot — production" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'production' | 'sandbox')}
              className="w-full rounded-lg border border-sentinel-700 bg-sentinel-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sentinel-500 focus:outline-none focus:ring-1 focus:ring-sentinel-500"
            >
              <option value="sandbox">Sandbox (sk_sandbox_...)</option>
              <option value="production">Production (sk_live_...)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Rate limit tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as (typeof RATE_LIMIT_TIERS)[number])}
              className="w-full rounded-lg border border-sentinel-700 bg-sentinel-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sentinel-500 focus:outline-none focus:ring-1 focus:ring-sentinel-500"
            >
              {RATE_LIMIT_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-300 mb-2 block">Read-only scopes</label>
          <div className="grid grid-cols-2 gap-2">
            {readOnlyScopes.map((scope) => (
              <ScopeCheckbox key={scope} scope={scope} checked={scopes.has(scope)} onToggle={() => toggleScope(scope)} />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Dangerous scopes — never pre-checked
          </label>
          <div className="grid grid-cols-2 gap-2">
            {dangerousScopes.map((scope) => (
              <ScopeCheckbox key={scope} scope={scope} checked={scopes.has(scope)} onToggle={() => toggleScope(scope)} dangerous />
            ))}
          </div>
          <p className="text-2xs text-slate-500 mt-2">
            MANAGE_LAUNCH requires CREATE_LAUNCH — checking one checks the other.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ScopeCheckbox({
  scope,
  checked,
  onToggle,
  dangerous,
}: {
  scope: Scope;
  checked: boolean;
  onToggle: () => void;
  dangerous?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-mono cursor-pointer transition ${
        checked
          ? dangerous
            ? 'border-amber-600/60 bg-amber-950/30 text-amber-300'
            : 'border-sky-600/50 bg-sky-950/20 text-sky-300'
          : 'border-sentinel-800 bg-sentinel-900/50 text-slate-400 hover:border-sentinel-700'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="accent-sky-500" />
      {scope}
    </label>
  );
}
