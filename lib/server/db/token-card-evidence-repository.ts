import 'server-only';

import { dbPool, isPostgresConfigured } from './pool';
import { logger } from '@/lib/server/logger';

export type EvidenceGroup = 'ownership' | 'security' | 'creator' | 'lifecycle';
const health = { successfulWrites: 0, failedWrites: 0, lastSuccessAt: null as string | null, lastFailureAt: null as string | null };

export function tokenCardPersistenceHealth() {
  return { configured: isPostgresConfigured(), ...health };
}

export async function saveTokenCardEvidence(
  mint: string,
  group: EvidenceGroup,
  evidence: Record<string, unknown>,
  observedAt: string,
  auditVersion?: string,
): Promise<void> {
  if (!isPostgresConfigured()) return;
  try {
    await dbPool.query(
      `INSERT INTO token_card_evidence_snapshots
         (mint, evidence_group, evidence, audit_version, observed_at)
       VALUES ($1, $2, $3::jsonb, $4, $5::timestamptz)
       ON CONFLICT (mint, evidence_group, observed_at) DO UPDATE SET
         evidence = EXCLUDED.evidence,
         audit_version = COALESCE(EXCLUDED.audit_version, token_card_evidence_snapshots.audit_version)`,
      [mint, group, JSON.stringify(evidence), auditVersion ?? null, observedAt],
    );
    health.successfulWrites += 1;
    health.lastSuccessAt = new Date().toISOString();
  } catch (error) {
    health.failedWrites += 1;
    health.lastFailureAt = new Date().toISOString();
    // Evidence still reaches Redis and the live socket. A database outage
    // reduces durability, not correctness of the active screen.
    logger.debug('[token-card-evidence] persistence unavailable', {
      mint,
      group,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
