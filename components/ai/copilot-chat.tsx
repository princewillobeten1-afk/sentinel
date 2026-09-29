'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useConnectWallet, useSession } from '@/lib/hooks/use-auth-hooks';
import { useAuth } from '@/components/auth/auth-provider';
import { PRIVACY_NOTICE, type EvidenceFact, type PilotAnswer, type PilotContext, type SavedTurn } from '@/lib/ai/pilot/contracts';
import { privacyViolation } from '@/lib/ai/pilot/privacy';
import { readPilotStream } from '@/lib/ai/pilot/stream';

const control = 'min-h-11 rounded-md border border-slate-700 px-3 text-xs hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400';
type Turn = Omit<SavedTurn, 'answer'> & { answer?: PilotAnswer; notes?: string[] };
type Session = { id: string; createdAt: string };
const setupMessages: Record<string, string> = {
  pilot_disabled: 'The owner has not enabled Copilot.',
  free_tier_unconfirmed: 'The owner must confirm the AI project billing tier.',
  model_access: 'The AI model connection needs configuration.',
  rate_limits: 'The AI project rate limits need configuration.',
  storage: 'Conversation storage needs configuration.',
};

function Evidence({ facts, now }: { facts: EvidenceFact[]; now: number }) {
  return <div className="grid min-w-0 grid-cols-2 gap-2">
    {facts.map(f => {
      const stale = f.status === 'stale' || !!f.expiresAt && Date.parse(f.expiresAt) <= now;
      const value = f.value === null ? 'Not measured' : typeof f.value === 'boolean' ? f.value ? 'Yes' : 'No'
        : typeof f.value === 'number' ? f.value.toLocaleString(undefined, { maximumSignificantDigits: 8 }) : f.value;
      return <div key={f.id} id={f.id} className="min-w-0 rounded-md border border-slate-800 bg-slate-900/40 p-2" title={f.mint ? `Mint: ${f.mint}` : undefined}>
        <div className="text-[11px] text-slate-400">{f.label}</div>
        {f.mint && <div className="truncate font-mono text-[11px] text-slate-500">{f.mint}</div>}
        <div className="break-words font-mono text-xs text-slate-100">{value} {f.value !== null && f.unit}</div>
        <div className={`mt-1 text-[11px] ${stale ? 'text-amber-300' : 'text-slate-400'}`}>
          {f.status === 'unavailable' ? 'Insufficient evidence' : stale ? 'Stale' : 'Measured'}
          {f.observedAt && <> · <time dateTime={f.observedAt}>{new Date(f.observedAt).toLocaleTimeString()}</time></>}
        </div>
      </div>;
    })}
  </div>;
}

export function CopilotChat({ context }: { context: PilotContext }) {
  const walletSession = useSession();
  const auth = useAuth();
  const isAuthenticated = auth.status === 'AUTHENTICATED' || walletSession.isAuthenticated;
  const token = auth.status === 'AUTHENTICATED' ? null : walletSession.token;
  const accountId = auth.user?.id ?? walletSession.user?.userId;
  const { openModal } = useConnectWallet();
  const consentId = useId(), questionId = useId();
  const [availability, setAvailability] = useState('Checking access...');
  const [ready, setReady] = useState(false), [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState(''), [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string>(), [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
  const [error, setError] = useState(''), [retryQuestion, setRetryQuestion] = useState('');
  const [deleting, setDeleting] = useState(false), [now, setNow] = useState(Date.now());
  const active = useRef<AbortController | null>(null), generation = useRef(0);
  const contextKey = JSON.stringify(context);
  const headers = useCallback(() => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);
  const json = useCallback(async (path: string, method = 'GET', signal?: AbortSignal) => {
    const response = await fetch('/api/v1/ai' + path, { method, headers: headers(), cache: 'no-store', signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? 'Copilot is temporarily unavailable.');
    return body.data;
  }, [headers]);
  const stop = useCallback(() => { generation.current++; active.current?.abort(); active.current = null; setBusy(false); }, []);
  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    setReady(false);
    if (!isAuthenticated) { setAvailability('Sign in to check Copilot access. Your conversations stay private.'); return; }
    try {
      const data = await json('', 'GET', signal);
      if (signal?.aborted) return;
      setReady(data.status === 'configured');
      const issues: string[] = Array.isArray(data.setupIssues) ? [...new Set<string>(data.setupIssues.filter((issue: unknown): issue is string => typeof issue === 'string'))] : [];
      setAvailability(data.status === 'configured' ? 'Public-data pilot · analysis only'
        : issues.length ? `Setup required. ${issues.map((issue: string) => setupMessages[issue]).filter(Boolean).join(' ')}`
          : 'Copilot setup is incomplete. Ask the owner to check the server configuration.');
      const saved = await json('/sessions', 'GET', signal);
      if (!signal?.aborted) setSessions(saved.sessions);
    } catch (e) { if (!signal?.aborted) setAvailability(e instanceof Error ? e.message : 'Copilot is unavailable.'); }
  }, [isAuthenticated, json]);
  useEffect(() => {
    const controller = new AbortController();
    setSessionId(undefined); setTurns([]); setSessions([]); setConsent(false); setError('');
    void loadStatus(controller.signal);
    return () => { controller.abort(); stop(); };
  }, [accountId, loadStatus, stop]);
  useEffect(() => {
    stop(); setProgress(''); setError(''); setRetryQuestion('');
    return stop;
  }, [contextKey, stop]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);

  const send = async (prompt: string) => {
    if (busy || !ready || !consent || prompt.trim().length < 2) return;
    if (privacyViolation(prompt)) { setError('Public market questions only. Keep personal details, secrets, and trade amounts outside chat.'); return; }
    stop(); const version = generation.current, controller = new AbortController(); active.current = controller;
    const id = crypto.randomUUID(); let completed = false;
    setBusy(true); setError(''); setRetryQuestion(prompt); setQuestion(''); setProgress('Checking public evidence...');
    setTurns(previous => [...previous, { id, question: prompt, context, facts: [], createdAt: new Date().toISOString() }]);
    const update = (change: (turn: Turn) => Turn) => { if (version === generation.current) setTurns(previous => previous.map(t => t.id === id ? change(t) : t)); };
    try {
      const response = await fetch('/api/v1/ai/copilot', { method: 'POST', headers: headers(), signal: controller.signal,
        body: JSON.stringify({ requestId: id, sessionId, question: prompt, context, privacyAccepted: true }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message ?? 'Copilot could not start this request.'); }
      if (!response.body) throw new Error('The response stream is unavailable.');
      await readPilotStream(response.body, event => {
        if (version !== generation.current) return;
        if (event.type === 'session') { setSessionId(event.sessionId); setSessions(previous => previous.some(s => s.id === event.sessionId) ? previous : [{ id: event.sessionId, createdAt: new Date().toISOString() }, ...previous]); }
        if (event.type === 'progress') setProgress(event.message);
        if (event.type === 'evidence') update(t => ({ ...t, facts: [...new Map([...t.facts, ...event.facts].map(f => [f.id, f])).values()], notes: [...new Set([...(t.notes ?? []), ...event.notes])] }));
        if (event.type === 'answer') update(t => ({ ...t, answer: event.answer }));
        if (event.type === 'error') setError(`${event.message} Reference: ${event.reference}`);
        if (event.type === 'done') completed = true;
      });
      if (!completed && !controller.signal.aborted) throw new Error('The response was interrupted. Measured evidence remains available.');
    } catch (e) {
      if (!controller.signal.aborted && version === generation.current) setError(e instanceof Error ? e.message : 'Copilot is temporarily unavailable.');
    } finally { controller.abort(); if (version === generation.current) { setBusy(false); setProgress(''); active.current = null; } }
  };
  const selectSession = async (id: string) => {
    stop(); const version = generation.current; setError(''); setRetryQuestion(''); setDeleting(false); setSessionId(id || undefined); setTurns([]);
    if (!id) return;
    try { const data = await json('/sessions/' + id); if (generation.current === version) setTurns(data.turns); }
    catch { if (generation.current === version) setError('Could not load this conversation.'); }
  };
  const removeSession = async () => {
    if (!sessionId) return;
    stop();
    try { await json('/sessions/' + sessionId, 'DELETE'); setSessions(previous => previous.filter(s => s.id !== sessionId)); setSessionId(undefined); setTurns([]); setDeleting(false); }
    catch { setError('Deletion failed. Please retry.'); }
  };

  return <section aria-label="Copilot chat" className="flex min-h-0 min-w-0 flex-1 flex-col text-xs text-slate-200">
    <div className="space-y-2 border-b border-slate-800 p-3">
      <p className="text-slate-400">{availability}</p>
      <div className="flex min-w-0 items-center gap-2 text-sky-300"><span className="truncate font-mono" title={context.mint}>{context.mint ? `${context.mint.slice(0, 8)}...${context.mint.slice(-6)}` : context.page === 'discover' ? 'Discover workspace' : 'No token selected'}</span><span>{context.timeframe} · {context.displayUnit === 'mcap' ? 'MCAP' : 'USD'}</span></div>
      {!isAuthenticated ? <div className="flex flex-wrap gap-2"><Link href="/api/v1/auth/google?returnTo=%2Fai" className={`${control} inline-flex items-center`}>Sign in with Google</Link><Link href="/login?returnTo=%2Fai" className={`${control} inline-flex items-center`}>Email sign in</Link><button className={control} onClick={openModal}>Connect wallet</button></div> : <>
        <div className="flex min-w-0 gap-2"><select aria-label="Conversation" className={`${control} min-w-0 flex-1 bg-sentinel-950`} value={sessionId ?? ''} onChange={e => void selectSession(e.target.value)}>
          <option value="">New conversation</option>{sessions.map(s => <option key={s.id} value={s.id}>{new Date(s.createdAt).toLocaleString()}</option>)}
        </select>{sessionId && <button className={control} onClick={() => setDeleting(true)}>Delete</button>}</div>
        {deleting && <div className="rounded-md border border-rose-400/30 p-2"><p className="mb-2">Permanently delete this conversation?</p><button className={control} onClick={() => void removeSession()}>Delete conversation</button> <button className={control} onClick={() => setDeleting(false)}>Keep</button></div>}
        {!ready && <button className={control} onClick={() => void loadStatus()}>Check setup again</button>}
      </>}
    </div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-3" aria-label="Conversation messages">
      {!turns.length && <div className="space-y-3 py-4"><h3 className="text-lg font-semibold">Evidence, before opinions.</h3><p className="leading-relaxed text-slate-400">Ask about a token, inspect its chart, compare exact mints, or explore discovery. Unknown data stays unknown. Copilot cannot execute trades.</p>
        {['Assess the selected token', 'Analyze this chart', 'What changed in the last hour?', 'Explain the discovery columns'].map(prompt => <button key={prompt} type="button" onClick={() => setQuestion(prompt)} className={`${control} mr-2 mt-2 text-left`}>{prompt}</button>)}
      </div>}
      {turns.map(t => <article key={t.id} className="space-y-3 border-b border-slate-800 pb-5">
        <p className="break-words rounded-md bg-sky-500/10 p-3 text-sm">{t.question}</p>
        <p className="font-mono text-[11px] text-slate-500">{t.context.mint ? `${t.context.mint.slice(0, 8)}...${t.context.mint.slice(-6)}` : t.context.page} · {t.context.timeframe} · {new Date(t.createdAt).toLocaleTimeString()}</p>
        {t.answer?.sections.map((s, i) => <div key={i}><h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.title} {t.answer?.validated ? '· evidence-based' : ''}</h4><p className="leading-relaxed">{s.text}</p>{s.evidenceIds.length > 0 && <p className="mt-1 text-[11px] text-slate-500">Evidence: {s.evidenceIds.map(id => t.facts.find(f => f.id === id)?.label).filter(Boolean).join(', ')}</p>}</div>)}
        {t.notes?.map(note => <p key={note} className="text-[11px] leading-relaxed text-amber-200/80">{note}</p>)}
        <Evidence facts={t.facts} now={now} />
        {!t.answer && !busy && <p className="text-slate-400">No completed explanation. You can retry; any measured facts above are retained.</p>}
      </article>)}
    </div>
    <div className="shrink-0 space-y-2 border-t border-slate-800 p-3">
      <p role="status" className="min-h-4 text-sky-300">{busy ? progress : turns.length ? 'Evidence is a snapshot. Ask again to refresh; no automatic AI calls.' : ''}</p>
      {error && <div role="alert" className="break-words rounded-md border border-amber-400/30 p-2 text-amber-200">{error}{retryQuestion && !busy && <button className={`${control} mt-2 block`} onClick={() => void send(retryQuestion)}>Retry question</button>}</div>}
      {!consent && <div className="rounded-md border border-slate-700 p-2 text-[11px] leading-relaxed text-slate-400"><p>{PRIVACY_NOTICE}</p><label htmlFor={consentId} className="flex min-h-11 items-center gap-2 text-slate-200"><input id={consentId} type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I understand and will use public data only</label></div>}
      <form onSubmit={e => { e.preventDefault(); void send(question); }} className="space-y-2">
        <label htmlFor={questionId} className="sr-only">Public market question</label>
        <textarea id={questionId} value={question} maxLength={1500} rows={2} onChange={e => setQuestion(e.target.value)} placeholder="Ask about public token data..." disabled={!ready}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(question); } }}
          className="w-full resize-none rounded-md border border-slate-700 bg-sentinel-900 p-3 text-sm outline-none focus:border-sky-400 disabled:opacity-50" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={!ready || !consent || busy || question.trim().length < 2} className={`${control} bg-sky-500/15 text-sky-300`}>Ask Copilot</button>
          {busy && <button type="button" className={control} onClick={() => { stop(); setProgress('Cancelled. Available evidence has been retained.'); }}>Cancel</button>}
          {context.mint && <Link className={`${control} inline-flex items-center`} href={`/trade/solana/${context.mint}`}>Prepare trade</Link>}
          <span className="text-[11px] text-slate-500">No trade execution · retained for up to 30 days</span>
        </div>
      </form>
    </div>
  </section>;
}
