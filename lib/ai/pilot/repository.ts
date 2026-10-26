import 'server-only';
import { randomUUID } from 'node:crypto';
import { dbPool } from '@/lib/server/db/pool';
import { ApiError } from '@/lib/server/errors';
import { logger } from '@/lib/server/logger';
import type { EvidenceFact, SavedTurn } from './contracts';

function isConnectionError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const code = anyErr.code;
  const msg = String(anyErr.message || '');
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ECONNRESET' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('connect ECONNREFUSED') ||
    msg.includes('Connection terminated') ||
    msg.includes('timeout') ||
    msg.includes('ETIMEDOUT')
  );
}

const globalForPilotRepo = globalThis as unknown as {
  __sentinelCopilotSessions?: Map<string, MemorySession>;
  __sentinelCopilotTurns?: Map<string, MemoryTurn>;
  __sentinelCopilotObservations?: MemoryObservation[];
  __pgUnreachableUntil?: number;
};

function isPostgresOnline(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  if (globalForPilotRepo.__pgUnreachableUntil && Date.now() < globalForPilotRepo.__pgUnreachableUntil) {
    return false;
  }
  return true;
}

function markPostgresDown() {
  globalForPilotRepo.__pgUnreachableUntil = Date.now() + 30_000;
}

interface MemorySession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: number;
}

interface MemoryTurn {
  id: string;
  sessionId: string;
  userId: string;
  question: string;
  context: unknown;
  facts: EvidenceFact[];
  answer: unknown;
  createdAt: string;
}

interface MemoryObservation {
  mint: string;
  facts: EvidenceFact[];
  provenance: unknown;
  observedAt: number;
}

const memorySessions = globalForPilotRepo.__sentinelCopilotSessions ?? new Map<string, MemorySession>();
const memoryTurns = globalForPilotRepo.__sentinelCopilotTurns ?? new Map<string, MemoryTurn>();
const memoryObservations = globalForPilotRepo.__sentinelCopilotObservations ?? [];

if (process.env.NODE_ENV !== 'production') {
  globalForPilotRepo.__sentinelCopilotSessions = memorySessions;
  globalForPilotRepo.__sentinelCopilotTurns = memoryTurns;
  globalForPilotRepo.__sentinelCopilotObservations = memoryObservations;
}

export async function pruneExpired() {
  const now = Date.now();
  for (const [id, session] of memorySessions) {
    if (session.expiresAt <= now) {
      memorySessions.delete(id);
      for (const [turnId, turn] of memoryTurns) {
        if (turn.sessionId === id) memoryTurns.delete(turnId);
      }
    }
  }

  const thirtyDaysAgo = now - 30 * 86400 * 1000;
  for (let i = memoryObservations.length - 1; i >= 0; i--) {
    if (memoryObservations[i].observedAt < thirtyDaysAgo) {
      memoryObservations.splice(i, 1);
    }
  }

  if (isPostgresOnline()) {
    try {
      await dbPool.query('DELETE FROM ai_copilot_sessions WHERE expires_at <= NOW()');
      await dbPool.query("DELETE FROM ai_copilot_observations WHERE observed_at < NOW() - INTERVAL '30 days'");
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }
}

export async function getSession(userId: string, id: string) {
  if (isPostgresOnline()) {
    try {
      const { rows } = await dbPool.query('SELECT id FROM ai_copilot_sessions WHERE id=$1 AND user_id=$2 AND expires_at > NOW()', [id, userId]);
      if (rows.length) return id;
      throw new ApiError('Conversation not found.', 404, 'AI_SESSION_NOT_FOUND');
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (isConnectionError(err)) {
        markPostgresDown();
      } else {
        throw err;
      }
    }
  }

  const session = memorySessions.get(id);
  if (!session || session.userId !== userId || session.expiresAt <= Date.now()) {
    throw new ApiError('Conversation not found.', 404, 'AI_SESSION_NOT_FOUND');
  }
  return id;
}

export async function openSession(userId: string, id?: string) {
  await pruneExpired();
  if (id) return getSession(userId, id);

  const created = randomUUID();
  memorySessions.set(created, {
    id: created,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 30 * 86400 * 1000,
  });

  if (isPostgresOnline()) {
    try {
      await dbPool.query('INSERT INTO ai_copilot_sessions(id,user_id) VALUES($1,$2)', [created, userId]);
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }

  return created;
}

export async function listSessions(userId: string) {
  await pruneExpired();

  if (isPostgresOnline()) {
    try {
      const { rows } = await dbPool.query<{ id: string; createdAt: string }>(
        'SELECT id, created_at AS "createdAt" FROM ai_copilot_sessions WHERE user_id=$1 AND expires_at>NOW() ORDER BY created_at DESC LIMIT 30',
        [userId]
      );
      return rows;
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }

  const now = Date.now();
  return Array.from(memorySessions.values())
    .filter(s => s.userId === userId && s.expiresAt > now)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 30)
    .map(s => ({ id: s.id, createdAt: s.createdAt }));
}

export async function getTurns(userId: string, sessionId: string): Promise<SavedTurn[]> {
  await getSession(userId, sessionId);

  if (isPostgresOnline()) {
    try {
      const { rows } = await dbPool.query<SavedTurn>(
        'SELECT id,question,context,facts,answer,created_at AS "createdAt" FROM (SELECT * FROM ai_copilot_turns WHERE session_id=$1 ORDER BY created_at DESC LIMIT 20) recent ORDER BY created_at',
        [sessionId]
      );
      return rows;
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }

  return Array.from(memoryTurns.values())
    .filter(t => t.sessionId === sessionId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(-20) as unknown as SavedTurn[];
}

export async function saveTurn(userId: string, sessionId: string, turn: Omit<SavedTurn, 'createdAt'>) {
  const session = memorySessions.get(sessionId);
  if (session && session.userId === userId && session.expiresAt > Date.now()) {
    memoryTurns.set(turn.id, {
      id: turn.id,
      sessionId,
      userId,
      question: turn.question,
      context: turn.context,
      facts: turn.facts,
      answer: turn.answer,
      createdAt: new Date().toISOString(),
    });
  }

  if (isPostgresOnline()) {
    try {
      await dbPool.query(
        `INSERT INTO ai_copilot_turns(id,session_id,question,context,facts,answer)
         SELECT $1,id,$4,$5,$6,$7 FROM ai_copilot_sessions WHERE id=$2 AND user_id=$3 AND expires_at>NOW() ON CONFLICT DO NOTHING`,
        [turn.id, sessionId, userId, turn.question, JSON.stringify(turn.context), JSON.stringify(turn.facts), JSON.stringify(turn.answer)]
      );
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }
}

export async function deleteSession(userId: string, id: string) {
  const session = memorySessions.get(id);
  if (session && session.userId === userId) {
    memorySessions.delete(id);
    for (const [turnId, t] of memoryTurns) {
      if (t.sessionId === id) memoryTurns.delete(turnId);
    }
  }

  if (isPostgresOnline()) {
    try {
      await dbPool.query('DELETE FROM ai_copilot_sessions WHERE id=$1 AND user_id=$2', [id, userId]);
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }
}

export async function saveObservation(mint: string, facts: EvidenceFact[], provenance: unknown) {
  memoryObservations.push({ mint, facts, provenance, observedAt: Date.now() });
  if (memoryObservations.length > 500) memoryObservations.shift();

  if (isPostgresOnline()) {
    try {
      await dbPool.query('INSERT INTO ai_copilot_observations(mint,facts,provenance) VALUES($1,$2,$3)', [mint, JSON.stringify(facts), JSON.stringify(provenance)]);
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }
}

export async function priorObservation(mint: string, minutes: number) {
  if (isPostgresOnline()) {
    try {
      const { rows } = await dbPool.query<{ facts: EvidenceFact[] }>(
        `SELECT facts FROM ai_copilot_observations WHERE mint=$1
         AND observed_at <= NOW() - ($2 * INTERVAL '1 minute') AND observed_at >= NOW() - ($2 * INTERVAL '1 minute') - INTERVAL '5 minutes'
         ORDER BY observed_at DESC LIMIT 1`,
        [mint, minutes]
      );
      if (rows.length) return rows[0].facts ?? [];
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }

  const target = Date.now() - minutes * 60000;
  const windowStart = target - 5 * 60000;
  const matching = memoryObservations.filter(o => o.mint === mint && o.observedAt <= target && o.observedAt >= windowStart);
  return matching.length ? matching[matching.length - 1].facts : [];
}

export async function recordUsage(input: { id: string; model: string; input: number; output: number; thinking: number; latency: number; tools: unknown; status: string }) {
  if (isPostgresOnline()) {
    try {
      await dbPool.query(
        `INSERT INTO ai_usage_metrics(id,feature_id,model_id,tokens_consumed,estimated_cost_usd,latency_ms,cached,grounding_score,input_tokens,output_tokens,thinking_tokens,prompt_version,tool_outcomes,request_status)
         VALUES($1,'COPILOT_CHAT',$2,$3,0,$4,FALSE,NULL,$5,$6,$7,'pilot-public-v1',$8,$9)`,
        [input.id, input.model, input.input + input.output + input.thinking, input.latency, input.input, input.output, input.thinking, JSON.stringify(input.tools), input.status]
      );
    } catch (err) {
      if (isConnectionError(err)) {
        markPostgresDown();
      }
    }
  }
}
