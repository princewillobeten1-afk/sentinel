import { fetchMigration, PUMPFUN_MIGRATION_AUTHORITY, type ResolvedMigration } from './migration-detector';
import { MIGRATED_WINDOW_MS } from './lifecycle-engine';

/** Recover recent events independently of /recent and trending token lists. */
export class MigrationHistory {
  private checked = new Map<string, number>();
  private running = false;

  async reconcile(rpcUrl: string, onMigration: (migration: ResolvedMigration) => void): Promise<void> {
    if (this.running) return;
    this.running = true;
    const now = Date.now();
    try {
      for (const [signature, retryAt] of this.checked) {
        if (retryAt < now - MIGRATED_WINDOW_MS) this.checked.delete(signature);
      }
      const response = await fetch(rpcUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(8_000),
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress',
          params: [PUMPFUN_MIGRATION_AUTHORITY, { limit: 100, commitment: 'confirmed' }] }),
      });
      if (!response.ok) return;
      const body = await response.json() as { result?: Array<{ signature?: string; err?: unknown; blockTime?: number | null }> };
      if (!Array.isArray(body.result)) return;
      const due = body.result.filter((row) => row.signature && row.err === null &&
        typeof row.blockTime === 'number' && now - row.blockTime * 1000 <= MIGRATED_WINDOW_MS &&
        row.blockTime * 1000 <= now && (this.checked.get(row.signature) ?? 0) <= now).slice(0, 8);
      // A small fixed budget per sweep, never one history scan per token card.
      for (const row of due) {
        const signature = row.signature!;
        this.checked.set(signature, now + 60_000);
        const resolved = await fetchMigration(rpcUrl, signature);
        if (!resolved) continue;
        this.checked.set(signature, now + MIGRATED_WINDOW_MS);
        onMigration(resolved);
      }
    } finally {
      this.running = false;
    }
  }
}
