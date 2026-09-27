import { z } from 'zod';
import { mintSchema } from './contracts';
import { CHART_TIMEFRAMES } from '@/lib/market/chart-model';

const token = z.object({ mint: mintSchema }).strict();
export const skills = {
  token_assessment: { version: '1', description: 'Read current measured public market, ownership and security facts for an exact Solana mint. Never infer missing fields or claim safety.', schema: token },
  chart_analysis: { version: '1', description: 'Read real USD candles and calculate EMA, RSI and Bollinger bands for an exact mint and timeframe. Sparse or non-contiguous history cannot support indicators.',
    schema: z.object({ mint: mintSchema, timeframe: z.enum(CHART_TIMEFRAMES) }).strict() },
  compare_tokens: { version: '1', description: 'Compare two or three exact Solana mints using the same 24h market window. Missing observations are not zero.',
    schema: z.object({ mints: z.array(mintSchema).min(2).max(3) }).strict() },
  discovery_search: { version: '1', description: 'Search actual live discovery tokens. Unknown ownership values fail active limits. Use minLiquidity in USD, maxAgeMinutes in minutes, holdings limits in percent. Never generate SQL. Ask for a mint if symbols are ambiguous.',
    schema: z.object({ query: z.string().max(60).optional(), section: z.enum(['new', 'migrating', 'graduated']).optional(),
      minLiquidity: z.number().min(0).max(1e12).optional(), maxAgeMinutes: z.number().min(0).max(525600).optional(),
      maxTop10: z.number().min(0).max(100).optional(), maxDev: z.number().min(0).max(100).optional(),
      maxSnipers: z.number().min(0).max(100).optional(), maxInsiders: z.number().min(0).max(100).optional(),
      maxBundlers: z.number().min(0).max(100).optional() }).strict() },
  what_changed: { version: '1', description: 'Compare a current observation with a genuinely stored earlier observation. Report insufficient history when absent; do not manufacture a prior snapshot.',
    schema: z.object({ mint: mintSchema, minutes: z.union([z.literal(15), z.literal(60), z.literal(1440)]) }).strict() },
  creator_analysis: { version: '1', description: 'Read recorded creator launch and migration counts for an exact token. Counts are not proof of common wallet ownership or rug pulls.', schema: token },
  platform_guide: { version: '1', description: 'Read curated Sentinel help, including how to prepare a trade locally. Cannot execute actions or access accounts.',
    schema: z.object({ topic: z.enum(['discovery', 'chart', 'audit', 'trade', 'privacy']) }).strict() },
} as const;
export type SkillName = keyof typeof skills;
export const GUIDE: Record<string, string> = {
  discovery: 'New Pairs shows launches. Final Stretch tracks bonding-curve progression. Migrated shows recorded graduations. Filters act on measured data; unknown audit fields are not safety clearance.',
  chart: 'Choose a timeframe on the chart. Price mode uses USD candles. Indicators need sufficient measured history. A pool series is not interchangeable with a token-wide series.',
  audit: 'Audit indicators describe recorded evidence, not a guarantee. Check freshness and missing observations. Holder classifications are estimates, not proof of identity or misconduct.',
  trade: 'Select Prepare trade to open the existing order panel. Enter amounts there, refresh the quote, review slippage and fees, and approve with your wallet. The Copilot cannot sign or broadcast.',
  privacy: 'This pilot accepts public market questions only. Private portfolios, wallet ownership, personal history and exact trade amounts must not be entered. Conversations can be deleted from the AI workspace.',
};
