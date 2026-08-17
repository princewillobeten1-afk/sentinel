'use client';

import React, { useEffect, useState } from 'react';

interface SessionItem {
  id: string;
  userId: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function SessionManager() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/v1/auth/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const res = await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchSessions();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAll = async () => {
    setActionLoading('all');
    try {
      const res = await fetch('/api/v1/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        window.location.href = '/login';
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="rounded-2xl bg-[#0d131f] border border-cyan-900/40 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Active Sessions</h2>
          <p className="text-xs text-cyan-200/60 mt-0.5">Manage devices and authorized browser sessions</p>
        </div>
        <button
          onClick={handleRevokeAll}
          disabled={actionLoading === 'all'}
          className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-semibold transition-all disabled:opacity-50"
        >
          {actionLoading === 'all' ? 'Revoking...' : 'Log Out All Devices'}
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500 animate-pulse">Loading active sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No active sessions found.</div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800/80"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white font-mono">
                    {s.ip || 'Unknown IP'}
                  </span>
                  {s.isCurrent && (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-2xs font-bold border border-cyan-500/30">
                      CURRENT SESSION
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate max-w-xs md:max-w-md">
                  {s.userAgent || 'Web Browser'}
                </p>
                <p className="text-2xs text-slate-500">
                  Created: {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>

              {!s.isCurrent && (
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={actionLoading === s.id}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-300 text-xs transition-all border border-slate-700 hover:border-red-500/40"
                >
                  {actionLoading === s.id ? 'Revoking...' : 'Revoke'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
