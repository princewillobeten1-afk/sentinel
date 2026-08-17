/**
 * WebSocket topic registry (Sprint 28 §14).
 *
 * Topics are `namespace.event:target`, e.g. `token.price:So111...`.
 * Pure parsing/validation helpers — no I/O, unit-testable.
 */

import type { Scope } from '@/lib/server/scopes';

export const TOPIC_KINDS = ['token.price', 'token.trade', 'token.risk'] as const;
export type TopicKind = (typeof TOPIC_KINDS)[number];

/** Which scope a subscriber must hold to listen on each topic kind. */
export const TOPIC_SCOPES: Record<TopicKind, Scope> = {
  'token.price': 'READ_MARKET_DATA',
  'token.trade': 'READ_MARKET_DATA',
  'token.risk': 'READ_TOKEN_INTELLIGENCE',
};

export interface ParsedTopic {
  kind: TopicKind;
  target: string;
  raw: string;
}

export function parseTopic(topic: string): ParsedTopic | null {
  const separatorIndex = topic.indexOf(':');
  if (separatorIndex <= 0) return null;

  const kind = topic.slice(0, separatorIndex);
  const target = topic.slice(separatorIndex + 1);

  if (!target) return null;
  if (!(TOPIC_KINDS as readonly string[]).includes(kind)) return null;

  return { kind: kind as TopicKind, target, raw: topic };
}

export function buildTopic(kind: TopicKind, target: string): string {
  return `${kind}:${target}`;
}
