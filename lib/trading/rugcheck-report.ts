import 'server-only';

import { readProvider, ProviderReadError, resetProviderCooldowns } from './provider-read';
import { rugcheckConfig, rugcheckReportUrl } from './rugcheck-config';
import { rugcheckHeaders } from './rugcheck-headers';

const AUTH_PROVIDER = 'Rugcheck authenticated';
const PUBLIC_PROVIDER = 'Rugcheck public';
const SHIELD_PROVIDER = 'Rugcheck Shield';
interface RugcheckRuntime {
  lastConfig: string;
  rejectedUntil: number;
  transientUntil: number;
  lastAuthStatus: number | null;
  lastSuccessAt: string | null;
  lastMode: 'authenticated' | 'shield' | 'public' | null;
  shieldStatus: 'unverified' | 'verified' | 'unavailable';
  inFlight: Map<string, Promise<any>>;
  nextReadAt: number;
}
// Route handlers are separate module graphs in Next. Share status and pacing
// with the worker actually fetching reports so the health route reflects it.
const globalForRugcheck = globalThis as typeof globalThis & { __sentinelRugcheck?: RugcheckRuntime };
const state: RugcheckRuntime = (globalForRugcheck.__sentinelRugcheck ??= {
  lastConfig: '', rejectedUntil: 0, transientUntil: 0, lastAuthStatus: null,
  lastSuccessAt: null, lastMode: null, shieldStatus: 'unverified',
  inFlight: new Map(), nextReadAt: 0,
});

/** Rugcheck's free report tier allows roughly one request per second. Reserve
 * start times globally, including for Shield and public fallback requests. */
async function pacedRead(provider: string, url: string, init: RequestInit): Promise<any> {
  const startAt = Math.max(Date.now(), state.nextReadAt);
  state.nextReadAt = startAt + 1_000;
  if (startAt > Date.now()) await new Promise(resolve => setTimeout(resolve, startAt - Date.now()));
  return readProvider(provider, url, init);
}

function config() {
  const value = rugcheckConfig();
  const identity = JSON.stringify([value.endpoint.href, value.apiKey, value.shield?.href]);
  if (identity !== state.lastConfig) {
    state.lastConfig = identity; state.rejectedUntil = 0; state.transientUntil = 0; state.lastAuthStatus = null;
    state.lastMode = null; state.lastSuccessAt = null; state.shieldStatus = 'unverified';
    resetProviderCooldowns(AUTH_PROVIDER); resetProviderCooldowns(SHIELD_PROVIDER);
  }
  return value;
}

async function load(mint: string, settings: ReturnType<typeof config>): Promise<any> {
  const url = rugcheckReportUrl(settings.endpoint, mint);
  const success = (body: any, mode: NonNullable<RugcheckRuntime['lastMode']>) => {
    if (body?.mint !== mint) throw new ProviderReadError('Rugcheck returned an invalid or mismatched token report.');
    state.lastMode = mode; state.lastSuccessAt = new Date().toISOString();
    return body;
  };
  let primaryError: unknown;
  if (settings.apiKey && Date.now() >= state.rejectedUntil && Date.now() >= state.transientUntil) {
    try {
      const body = await pacedRead(AUTH_PROVIDER, url, {
        headers: rugcheckHeaders(), redirect: 'error',
      });
      const report = success(body, 'authenticated');
      state.lastAuthStatus = 200;
      return report;
    } catch (error) {
      const reason = error instanceof ProviderReadError ? error.reason : '';
      const status = /HTTP (\d+)/.exec(reason);
      if (status) state.lastAuthStatus = Number(status[1]);
      // Shield shares the account's limits. Never switch credentials to evade quotas.
      if (/quota|HTTP 429|cooling down/i.test(reason)) throw error;
      if (/HTTP (401|403)/.test(reason)) state.rejectedUntil = Date.now() + 15 * 60_000;
      else if (/HTTP 5\d\d|timed out or failed|invalid|mismatched/.test(reason)) state.transientUntil = Date.now() + 30_000;
      else throw error;
      primaryError = error;
    }
  }
  if (settings.shield) {
    try {
      const body = await pacedRead(SHIELD_PROVIDER, rugcheckReportUrl(settings.shield, mint), {
        headers: { Accept: 'application/json' }, redirect: 'error',
      });
      const report = success(body, 'shield');
      state.shieldStatus = 'verified';
      return report;
    } catch (error) {
      state.shieldStatus = 'unavailable';
      const reason = error instanceof ProviderReadError ? error.reason : '';
      if (/quota|HTTP 429|cooling down/i.test(reason)) throw error;
      primaryError ??= error;
    }
  }
  // Public reports preserve the existing no-key behavior and survive a wrong
  // optional key. Server failures with valid credentials remain visible.
  if (!settings.apiKey || Date.now() < state.rejectedUntil) {
    return success(await pacedRead(PUBLIC_PROVIDER, url, {
      headers: { Accept: 'application/json' }, redirect: 'error',
    }), 'public');
  }
  throw primaryError ?? new ProviderReadError('Rugcheck report service is temporarily unavailable.');
}

/** Shared by holder enrichment and LP lock audits. Collapse concurrent reads of
 * the same mint without re-stamping a cached report as freshly observed. */
export async function readRugcheckReport(mint: string): Promise<any> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) throw new ProviderReadError('Rugcheck requires a valid Solana mint.');
  const settings = config();
  const key = `${state.lastConfig}:${mint}`;
  const pending = state.inFlight.get(key);
  if (pending) return pending;
  if (state.inFlight.size >= 64) throw new ProviderReadError('Rugcheck report queue is busy.');
  const work = load(mint, settings).finally(() => state.inFlight.delete(key));
  state.inFlight.set(key, work);
  return work;
}

export function rugcheckAccessHealth() {
  try {
    const settings = config();
    return { configured: Boolean(settings.apiKey), endpointConfigured: true, lastAuthStatus: state.lastAuthStatus,
      authenticatedAccess: !settings.apiKey ? 'unconfigured' : Date.now() < state.rejectedUntil ? 'rejected'
        : state.lastAuthStatus === 200 ? 'verified' : 'unverified',
      shield: settings.shieldInvalid ? 'invalid-config' : !settings.shield ? 'unconfigured' : state.shieldStatus,
      lastMode: state.lastMode, lastSuccessAt: state.lastSuccessAt, inFlight: state.inFlight.size,
      retryAfter: Math.max(state.rejectedUntil, state.transientUntil) > Date.now()
        ? new Date(Math.max(state.rejectedUntil, state.transientUntil)).toISOString() : null };
  } catch { return { configured: false, endpointConfigured: false, authenticatedAccess: 'invalid-config', lastMode: null }; }
}

export function resetRugcheckAccessForTests(): void {
  state.lastConfig = ''; state.rejectedUntil = 0; state.transientUntil = 0; state.lastAuthStatus = null;
  state.lastSuccessAt = null; state.lastMode = null; state.shieldStatus = 'unverified';
  state.inFlight.clear(); state.nextReadAt = 0;
  resetProviderCooldowns(AUTH_PROVIDER); resetProviderCooldowns(PUBLIC_PROVIDER); resetProviderCooldowns(SHIELD_PROVIDER);
}
