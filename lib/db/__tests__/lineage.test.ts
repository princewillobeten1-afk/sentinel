import { describe, it, expect } from 'vitest';
import { DataLineageEngine } from '../lineage';

describe('Data Lineage & Reproducibility Engine', () => {
  it('validates complete financial lineage from user down to P&L', () => {
    const validFinancialTrace = {
      userId: 'usr_alice_01',
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      transactionHash: '5Kj8xWv3m6y8r7u...',
      tradeId: 'trd_swap_001',
      positionId: 'pos_sol_001',
      portfolioId: 'port_main_01',
      pnlEventId: 'pnl_close_01',
      realizedPnl: 450.75,
    };

    const res = DataLineageEngine.verifyFinancialLineage(validFinancialTrace);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.tracePath.length).toBe(7);
    expect(res.tracePath[0]).toContain('USER');
    expect(res.tracePath[6]).toContain('P&L');
  });

  it('detects missing intermediate link in financial lineage', () => {
    const brokenTrace = {
      userId: 'usr_bob_02',
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      transactionHash: '', // Missing on-chain tx!
      tradeId: 'trd_swap_002',
      positionId: 'pos_sol_002',
      portfolioId: 'port_main_02',
      pnlEventId: 'pnl_close_02',
      realizedPnl: 120.0,
    };

    const res = DataLineageEngine.verifyFinancialLineage(brokenTrace);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Missing transactionHash in lineage trace');
  });

  it('validates complete intelligence lineage from blockchain event to explainable risk report', () => {
    const validIntelTrace = {
      chain: 'solana',
      slot: 289104000,
      transactionHash: '5Kj8xWv3m6y8r7u...',
      tokenMint: 'So11111111111111111111111111111111111111112',
      holderClusters: ['cluster_insider_alpha', 'cluster_creator_team'],
      ownershipScore: 45,
      creatorReputationScore: 30,
      organicVolumeRatio: 0.25,
      insiderSignalCount: 3,
      exitabilityScore: 40,
      finalRiskScore: 82,
      explanationSummary: 'High insider concentration and low organic volume',
      modelVersion: 'sentinel-risk-model-v2.4',
      dataSnapshotHash: 'snap_289104000_abc',
    };

    const res = DataLineageEngine.verifyIntelligenceLineage(validIntelTrace);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.tracePath.length).toBe(10);
    expect(res.tracePath[0]).toContain('BLOCKCHAIN');
    expect(res.tracePath[9]).toContain('EXPLANATION');
  });
});
