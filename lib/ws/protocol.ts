/**
 * WebSocket wire protocol (Sprint 28 §12-14).
 *
 * Pure types + one pure parser — no I/O, no `ws` import — so this is
 * directly unit-testable and safe to import from either side.
 */

export type ClientMessage =
  | { type: 'subscribe'; topics: string[] }
  | { type: 'unsubscribe'; topics: string[] }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'welcome'; connectionId: string; maxSubscriptions: number }
  | { type: 'subscribed'; topics: string[] }
  | { type: 'unsubscribed'; topics: string[] }
  | { type: 'event'; topic: string; sequence: number; data: unknown; ts: string }
  | { type: 'pong' }
  | { type: 'error'; code: string; message: string };

export interface ParseSuccess {
  ok: true;
  message: ClientMessage;
}

export interface ParseFailure {
  ok: false;
  code: string;
  message: string;
}

/**
 * Parses an inbound client frame. Never throws — a malformed frame from one
 * client should produce an error message back to that client, not take down
 * the connection handler.
 */
export function parseClientMessage(raw: string): ParseSuccess | ParseFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'INVALID_JSON', message: 'Message must be valid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, code: 'INVALID_MESSAGE', message: 'Message must be a JSON object.' };
  }

  const { type, topics } = parsed as { type?: unknown; topics?: unknown };

  if (type === 'ping') return { ok: true, message: { type: 'ping' } };

  if (type === 'subscribe' || type === 'unsubscribe') {
    if (!Array.isArray(topics) || topics.some((topic) => typeof topic !== 'string')) {
      return { ok: false, code: 'INVALID_TOPICS', message: '`topics` must be an array of strings.' };
    }
    if (topics.length === 0) {
      return { ok: false, code: 'INVALID_TOPICS', message: '`topics` must not be empty.' };
    }
    return { ok: true, message: { type, topics: topics as string[] } };
  }

  return { ok: false, code: 'UNKNOWN_MESSAGE_TYPE', message: `Unsupported message type: ${String(type)}` };
}

export function serialize(message: ServerMessage): string {
  return JSON.stringify(message);
}
