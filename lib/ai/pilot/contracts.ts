import { z } from 'zod';
import bs58 from 'bs58';
import { CHART_TIMEFRAMES } from '@/lib/market/chart-model';

export const mintSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).refine(value => {
  try { return bs58.decode(value).length === 32; } catch { return false; }
}, 'An exact Solana mint is required.');
export const contextSchema = z.object({
  page: z.enum(['ai', 'trade', 'discover']).default('ai'),
  chain: z.literal('solana').default('solana'),
  mint: mintSchema.optional(),
  timeframe: z.enum(CHART_TIMEFRAMES).default('1m'),
  displayUnit: z.enum(['price', 'mcap']).default('price'),
}).strict();
export type PilotContext = z.infer<typeof contextSchema>;
export const requestSchema = z.object({
  requestId: z.string().uuid(), sessionId: z.string().uuid().optional(),
  question: z.string().trim().min(2).max(1500), context: contextSchema,
  privacyAccepted: z.literal(true),
}).strict();
export type PilotRequest = z.infer<typeof requestSchema>;

export interface EvidenceFact {
  id: string; mint?: string; metric: string; label: string;
  value: number | boolean | string | null; unit: string;
  status: 'measured' | 'stale' | 'unavailable'; observedAt: string | null;
  expiresAt: string | null; category: 'market' | 'ownership' | 'security' | 'creator' | 'chart' | 'history' | 'guide';
}
export interface ToolResult { facts: EvidenceFact[]; notes: string[]; candidates?: string[] }
export const answerSchema = z.object({
  sections: z.array(z.object({
    title: z.enum(['Overview', 'Evidence', 'Caution', 'Limitations', 'Next step']),
    text: z.string().min(1).max(700), evidenceIds: z.array(z.string()).max(12),
  }).strict()).min(1).max(5),
}).strict();
export type PilotAnswer = z.infer<typeof answerSchema> & { validated: boolean };
export type PilotEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'progress'; message: string }
  | { type: 'evidence'; facts: EvidenceFact[]; notes: string[] }
  | { type: 'answer'; answer: PilotAnswer }
  | { type: 'error'; code: string; message: string; reference: string }
  | { type: 'done'; requestId: string };
export interface SavedTurn { id: string; question: string; context: PilotContext; facts: EvidenceFact[]; answer: PilotAnswer; createdAt: string }
export const PRIVACY_NOTICE = 'Public market questions only. Free-tier AI inputs and outputs may be used to improve the external AI service and reviewed by humans. Do not enter personal, sensitive, or confidential information, wallet ownership, trade amounts, account details, or secrets.';
