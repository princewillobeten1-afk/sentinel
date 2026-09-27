import 'server-only';
import { randomUUID } from 'node:crypto';
import { dbPool } from '@/lib/server/db/pool';
import { ApiError } from '@/lib/server/errors';
import type { EvidenceFact, SavedTurn } from './contracts';

export async function pruneExpired() {
  await dbPool.query('DELETE FROM ai_copilot_sessions WHERE expires_at <= NOW()');
  await dbPool.query("DELETE FROM ai_copilot_observations WHERE observed_at < NOW() - INTERVAL '30 days'");
}
export async function getSession(userId: string, id: string) {
  const { rows } = await dbPool.query('SELECT id FROM ai_copilot_sessions WHERE id=$1 AND user_id=$2 AND expires_at > NOW()', [id, userId]);
  if (!rows.length) throw new ApiError('Conversation not found.', 404, 'AI_SESSION_NOT_FOUND');
  return id;
}
export async function openSession(userId: string, id?: string) {
  await pruneExpired();
  if (id) return getSession(userId, id);
  const created = randomUUID();
  await dbPool.query('INSERT INTO ai_copilot_sessions(id,user_id) VALUES($1,$2)', [created, userId]);
  return created;
}
export async function listSessions(userId: string) {
  await pruneExpired();
  return (await dbPool.query<{ id: string; createdAt: string }>('SELECT id, created_at AS "createdAt" FROM ai_copilot_sessions WHERE user_id=$1 AND expires_at>NOW() ORDER BY created_at DESC LIMIT 30', [userId])).rows;
}
export async function getTurns(userId: string, sessionId: string): Promise<SavedTurn[]> {
  await getSession(userId, sessionId);
  return (await dbPool.query<SavedTurn>('SELECT id,question,context,facts,answer,created_at AS "createdAt" FROM (SELECT * FROM ai_copilot_turns WHERE session_id=$1 ORDER BY created_at DESC LIMIT 20) recent ORDER BY created_at', [sessionId])).rows;
}
export async function saveTurn(userId: string, sessionId: string, turn: Omit<SavedTurn, 'createdAt'>) {
  // INSERT SELECT rechecks ownership/expiry atomically; deletion during a stream cannot recreate it.
  await dbPool.query(`INSERT INTO ai_copilot_turns(id,session_id,question,context,facts,answer)
    SELECT $1,id,$4,$5,$6,$7 FROM ai_copilot_sessions WHERE id=$2 AND user_id=$3 AND expires_at>NOW() ON CONFLICT DO NOTHING`,
  [turn.id, sessionId, userId, turn.question, JSON.stringify(turn.context), JSON.stringify(turn.facts), JSON.stringify(turn.answer)]);
}
export async function deleteSession(userId: string, id: string) {
  await dbPool.query('DELETE FROM ai_copilot_sessions WHERE id=$1 AND user_id=$2', [id, userId]);
}
export async function saveObservation(mint: string, facts: EvidenceFact[], provenance: unknown) {
  await dbPool.query('INSERT INTO ai_copilot_observations(mint,facts,provenance) VALUES($1,$2,$3)', [mint, JSON.stringify(facts), JSON.stringify(provenance)]);
}
export async function priorObservation(mint: string, minutes: number) {
  const { rows } = await dbPool.query<{ facts: EvidenceFact[] }>(`SELECT facts FROM ai_copilot_observations WHERE mint=$1
    AND observed_at <= NOW() - ($2 * INTERVAL '1 minute') AND observed_at >= NOW() - ($2 * INTERVAL '1 minute') - INTERVAL '5 minutes'
    ORDER BY observed_at DESC LIMIT 1`, [mint, minutes]);
  return rows[0]?.facts ?? [];
}
export async function recordUsage(input: { id: string; model: string; input: number; output: number; thinking: number; latency: number; tools: unknown; status: string }) {
  await dbPool.query(`INSERT INTO ai_usage_metrics(id,feature_id,model_id,tokens_consumed,estimated_cost_usd,latency_ms,cached,grounding_score,input_tokens,output_tokens,thinking_tokens,prompt_version,tool_outcomes,request_status)
    VALUES($1,'COPILOT_CHAT',$2,$3,0,$4,FALSE,NULL,$5,$6,$7,'pilot-public-v1',$8,$9)`,
  [input.id, input.model, input.input + input.output + input.thinking, input.latency, input.input, input.output, input.thinking, JSON.stringify(input.tools), input.status]);
}
