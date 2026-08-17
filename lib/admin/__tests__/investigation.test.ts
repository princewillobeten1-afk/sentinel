import { describe, it, expect } from 'vitest';
import { AdminInvestigationService } from '../investigation';

describe('Multi-Entity Investigation Workspace Engine (Sprint 39 §11-22, §80)', () => {
  it('compiles a comprehensive Token Dossier with timeline and evidence citations', async () => {
    const dossier = await AdminInvestigationService.investigateEntity(
      'TOKEN',
      'So11111111111111111111111111111111111111112'
    );

    expect(dossier.entityType).toBe('TOKEN');
    expect(dossier.title).toContain('$SENT');
    expect(dossier.riskScore).toBeLessThan(50);
    expect(dossier.timeline.length).toBeGreaterThan(0);
    expect(dossier.evidence.length).toBeGreaterThan(0);
    expect(dossier.aiAnalysis?.confidencePct).toBeGreaterThan(80);
  });

  it('detects high risk sniper clusters and wash volume on suspicious token $SOLM', async () => {
    const dossier = await AdminInvestigationService.investigateEntity('TOKEN', '9pW2...8b11');

    expect(dossier.riskLevel).toBe('CRITICAL');
    expect(dossier.status).toBe('RESTRICTED');
    expect(dossier.detectedSignals).toContain('COORDINATED_SNIPER_CLUSTER');
    expect(dossier.aiAnalysis?.recommendedActions).toContain('Flag token with high risk warning badge');
  });

  it('compiles a Wallet Dossier with trading metrics and funding provenance', async () => {
    const dossier = await AdminInvestigationService.investigateEntity('WALLET', '8r9Zg7kP3QW6...whaleAlpha');

    expect(dossier.entityType).toBe('WALLET');
    expect(dossier.summary.address).toContain('8r9Z');
    expect(dossier.detectedSignals).toContain('SMART_MONEY_TRADER');
  });

  it('compiles an Order Dossier tracing complete lifecycle from intent to on-chain confirmation', async () => {
    const dossier = await AdminInvestigationService.investigateEntity('ORDER', 'ord_sent_001');

    expect(dossier.entityType).toBe('ORDER');
    expect(dossier.timeline.length).toBe(4);
    expect(dossier.summary.txHash).toBeDefined();
  });
});
