'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Inbox, Bell, Pause, Play, Trash2 } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData, ApiRequestError } from '@/lib/api/response';

/**
 * The triggered-alert feed, read from `/api/v1/alerts`.
 *
 * This view previously rendered a three-item array declared inline — the same
 * three fabricated threats for every user, on every load, forever. The Phase 4
 * alert domain (Postgres-backed rules, events and read state) existed but
 * nothing in the mounted UI read from it.
 *
 * Fields rendered here are exactly the ones the event DTO carries. The mock's
 * `confidence`, `evidence` and `impact` strings had no counterpart in the
 * schema, so they are not reproduced as invented values.
 */

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type ReadState = 'UNREAD' | 'READ' | 'ACTIONED' | 'DISMISSED';

interface AlertEvent {
  id: string;
  ruleId: string;
  title: string | null;
  summary: string | null;
  severity: Severity | null;
  category: string | null;
  token: string | null;
  readState: ReadState;
  timestamp: string;
}

interface AlertRule {
  id: string;
  name: string;
  alertType: string;
  status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'EXPIRED' | 'DELETED';
  category: string | null;
  severity: Severity | null;
  conditions: Record<string, unknown>;
  channels: string[];
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'risk-critical',
  HIGH: 'risk-high',
  MEDIUM: 'risk-med',
  LOW: 'risk-low',
};

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AlertsView() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState('RISK');
  const [ruleSeverity, setRuleSeverity] = useState<Severity>('HIGH');
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [isRuleSaving, setIsRuleSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(endpoints.alerts.events, { limit: 50 }), {
        credentials: 'include',
      });
      const data = await readApiData<{ alerts: AlertEvent[] }>(res, 'Failed to load alerts');
      setAlerts(data.alerts ?? []);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        setError('Sign in to see your alerts.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load alerts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadRules = useCallback(async () => {
    try {
      const response = await fetch(apiUrl(endpoints.alerts.rules, { limit: 50 }), { credentials: 'include' });
      const data = await readApiData<{ rules: AlertRule[] }>(response, 'Failed to load alert rules');
      setRules(data.rules ?? []);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return;
      setRuleError(err instanceof Error ? err.message : 'Failed to load alert rules.');
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const createRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ruleName.trim()) return;
    setIsRuleSaving(true);
    setRuleError(null);
    try {
      const response = await fetch(apiUrl(endpoints.alerts.rules), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: ruleName.trim(), alertType: ruleType, severity: ruleSeverity, channels: ['IN_APP'] }),
      });
      const data = await readApiData<{ rule: AlertRule }>(response, 'Failed to create alert rule');
      setRules((previous) => [data.rule, ...previous]);
      setRuleName('');
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : 'Failed to create alert rule.');
    } finally {
      setIsRuleSaving(false);
    }
  };

  const updateRule = async (rule: AlertRule, status: 'ACTIVE' | 'PAUSED') => {
    const previous = rules;
    setRules((items) => items.map((item) => item.id === rule.id ? { ...item, status } : item));
    try {
      const response = await fetch(apiUrl(endpoints.alerts.rule(rule.id)), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await readApiData<{ rule: AlertRule }>(response, 'Failed to update alert rule');
      setRules((items) => items.map((item) => item.id === rule.id ? data.rule : item));
    } catch (err) {
      setRules(previous);
      setRuleError(err instanceof Error ? err.message : 'Failed to update alert rule.');
    }
  };

  const deleteRule = async (rule: AlertRule) => {
    const previous = rules;
    setRules((items) => items.filter((item) => item.id !== rule.id));
    try {
      const response = await fetch(apiUrl(endpoints.alerts.rule(rule.id)), { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error('Failed to delete alert rule.');
    } catch (err) {
      setRules(previous);
      setRuleError(err instanceof Error ? err.message : 'Failed to delete alert rule.');
    }
  };

  /**
   * Optimistic, but reverted on failure. The read state is server-authoritative
   * (the transition table rejects illegal moves), so a local flip that the
   * server refused must not be left on screen.
   */
  const acknowledge = async (id: string) => {
    const previous = alerts;
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, readState: 'READ' } : a)));
    try {
      const res = await fetch(apiUrl(endpoints.alerts.event(id)), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ readState: 'READ' }),
      });
      if (!res.ok) setAlerts(previous);
    } catch {
      setAlerts(previous);
    }
  };

  return (
    <div className="space-y-6">
      <div data-page-header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-400" /> Risk alerts
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Explainable risk evidence detailing why a token is flagged rather than unexplained scores.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {isLoading && alerts.length === 0 && (
        <div className="p-12 text-center text-slate-400 font-mono">
          <div className="inline-block animate-spin h-6 w-6 border-2 border-sky-400 border-t-transparent rounded-full mb-3" />
          <p>Loading threat intelligence…</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-300">Alerts unavailable</h4>
            <p className="text-xs text-slate-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      <Panel title={<span className="flex items-center gap-2"><Bell className="h-4 w-4 text-sky-400" /> Alert rules</span>} subtitle="Create, pause, resume, and remove the rules that produce risk events.">
        <form onSubmit={createRule} className="grid gap-2 md:grid-cols-[1fr_150px_130px_auto]">
          <input aria-label="Alert rule name" value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="Rule name" className="h-9 rounded-md border border-sentinel-800 bg-sentinel-950 px-2 text-xs text-slate-100" />
          <select aria-label="Alert type" value={ruleType} onChange={(event) => setRuleType(event.target.value)} className="h-9 rounded-md border border-sentinel-800 bg-sentinel-950 px-2 text-xs text-slate-100"><option value="RISK">Risk</option><option value="PRICE">Price</option><option value="LIQUIDITY">Liquidity</option><option value="WALLET">Wallet</option></select>
          <select aria-label="Alert severity" value={ruleSeverity} onChange={(event) => setRuleSeverity(event.target.value as Severity)} className="h-9 rounded-md border border-sentinel-800 bg-sentinel-950 px-2 text-xs text-slate-100">{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]).map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select>
          <Button type="submit" disabled={isRuleSaving || !ruleName.trim()}>{isRuleSaving ? 'Saving…' : 'Create rule'}</Button>
        </form>
        {ruleError && <p role="alert" className="mt-2 text-xs text-amber-400">{ruleError}</p>}
        <div className="mt-4 space-y-2">
          {rules.filter((rule) => rule.status !== 'DELETED').map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sentinel-800 bg-sentinel-950 p-2 text-xs">
              <div className="min-w-0"><p className="truncate font-semibold text-slate-100">{rule.name}</p><p className="text-2xs text-slate-500">{rule.alertType} · {rule.severity ?? 'unspecified'} · {rule.status.toLowerCase()}</p></div>
              <div className="flex items-center gap-1"><Button variant="ghost" size="xs" onClick={() => void updateRule(rule, rule.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')} leftIcon={rule.status === 'PAUSED' ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}>{rule.status === 'PAUSED' ? 'Resume' : 'Pause'}</Button><button type="button" onClick={() => void deleteRule(rule)} aria-label={`Delete ${rule.name}`} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></div>
            </div>
          ))}
          {rules.length === 0 && <p className="text-xs text-slate-500">No saved rules yet.</p>}
        </div>
      </Panel>

      {!isLoading && !error && alerts.length === 0 && (
        <div className="p-12 text-center">
          <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-100">No alerts yet</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            Nothing has triggered. Alerts appear here when one of your rules matches live market data.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {alerts.map((item) => (
          <Panel
            key={item.id}
            title={
              <div className="flex items-center justify-between w-full gap-3">
                <span className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                  <AlertTriangle
                    className={
                      item.severity === 'CRITICAL' ? 'h-4 w-4 text-rose-400' : 'h-4 w-4 text-amber-400'
                    }
                  />
                  {item.title || 'Alert triggered'}
                  {item.token && (
                    <>
                      {' — '}
                      <strong className="text-sky-300">${item.token}</strong>
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {item.readState === 'UNREAD' && (
                    <span className="h-2 w-2 rounded-full bg-sky-400" aria-label="Unread" />
                  )}
                  {item.severity && (
                    <Badge variant={(SEVERITY_BADGE[item.severity] ?? 'risk-med') as never}>
                      {item.severity.toLowerCase()} severity
                    </Badge>
                  )}
                </div>
              </div>
            }
            subtitle={`Triggered ${relativeTime(item.timestamp)}${item.category ? ` • ${item.category}` : ''}`}
          >
            <div className="space-y-3 text-xs">
              {item.summary && (
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 space-y-1">
                  <p className="label-micro">Supporting Evidence</p>
                  <p className="text-slate-200 leading-relaxed font-sans">{item.summary}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 font-mono text-2xs">
                <span className="text-slate-400">
                  {item.readState === 'UNREAD' ? 'Awaiting review' : `Marked ${item.readState.toLowerCase()}`}
                </span>
                {item.readState === 'UNREAD' && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => acknowledge(item.id)}
                    leftIcon={<CheckCircle2 className="h-3 w-3" />}
                  >
                    Mark as read
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
