import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoreService } from '../lore-service';

describe('LoreService - Token Narrative & Runner Intelligence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retrieves rich curated lore for flagship tokens (e.g. CHILLGUY, MOODENG, PNUT, GOAT)', async () => {
    const chillGuyLore = await LoreService.getLoreForToken({
      mint: 'Df6yfrKC8kZE3KNkrHERKzAChZSaRDKwmmKgevpump',
      symbol: 'CHILLGUY',
      name: 'Just a chill guy',
    });

    expect(chillGuyLore).toBeDefined();
    expect(chillGuyLore.symbol).toBe('CHILLGUY');
    expect(chillGuyLore.narrativeCategory).toBe('Viral TikTok & Reels');
    expect(chillGuyLore.headline).toContain('TikTok');
    expect(chillGuyLore.loreSummary).toContain('Phillip Banks');
    expect(chillGuyLore.originSpark.source).toBe('TikTok');
    expect(chillGuyLore.originSpark.creatorName).toContain('Phillip Banks');
    expect(chillGuyLore.whyItsFlying.length).toBeGreaterThan(0);
    expect(chillGuyLore.viralityScore).toBeGreaterThanOrEqual(90);
    expect(chillGuyLore.communityVibe.conviction).toBe('EXTREME');
  });

  it('correctly identifies a token as the FIRST RUNNER (OG) when it is the earliest pair in the cohort', async () => {
    const ogMint = 'CzLSujWBLFsSjncfkh59rQDqJgCSwUiV3Q2CBi42pump';
    const copycatMint = 'CopyCatGOATTokenMintAddress11111111111111111';

    // Mock fetch for DexScreener search returning two tokens in the cohort
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('api.dexscreener.com/latest/dex/search')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'solana',
                baseToken: { address: ogMint, symbol: 'GOAT', name: 'Goatseus Maximus' },
                pairCreatedAt: 1729000000000, // Earliest timestamp = OG
                marketCap: 600000000,
                dexId: 'raydium',
              },
              {
                chainId: 'solana',
                baseToken: { address: copycatMint, symbol: 'GOAT', name: 'Goatseus Maximus Copy' },
                pairCreatedAt: 1729001200000, // 20 minutes later = Secondary runner
                marketCap: 2000000,
                dexId: 'raydium',
              },
            ],
          }),
        } as any;
      }
      return { ok: false } as any;
    });

    const lore = await LoreService.getLoreForToken({
      mint: ogMint,
      symbol: 'GOAT',
      name: 'Goatseus Maximus',
    });

    expect(lore.runnerStatus.isFirstRunner).toBe(true);
    expect(lore.runnerStatus.runnerRank).toBe(1);
    expect(lore.runnerStatus.badgeLabel).toBe('FIRST RUNNER (OG)');
    expect(lore.runnerStatus.badgeVariant).toBe('og');
    expect(lore.runnerStatus.explanation).toContain('Earliest recorded launch');
    expect(lore.runnerStatus.totalRunnersInCohort).toBe(2);
  });

  it('correctly identifies a secondary duplicate token as RUNNER #2 with calculated time delta', async () => {
    const ogMint = 'CzLSujWBLFsSjncfkh59rQDqJgCSwUiV3Q2CBi42pump';
    const runner2Mint = 'Runner2GOATTokenMintAddress22222222222222222';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('api.dexscreener.com/latest/dex/search')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'solana',
                baseToken: { address: ogMint, symbol: 'GOAT', name: 'Goatseus Maximus OG' },
                pairCreatedAt: 1729000000000, // 0s
                marketCap: 500000000,
              },
              {
                chainId: 'solana',
                baseToken: { address: runner2Mint, symbol: 'GOAT', name: 'Goatseus Maximus Runner 2' },
                pairCreatedAt: 1729001080000, // 1080 seconds = 18 minutes later
                marketCap: 1500000,
              },
            ],
          }),
        } as any;
      }
      return { ok: false } as any;
    });

    const lore = await LoreService.getLoreForToken({
      mint: runner2Mint,
      symbol: 'GOAT',
      name: 'Goatseus Maximus Runner 2',
    });

    expect(lore.runnerStatus.isFirstRunner).toBe(false);
    expect(lore.runnerStatus.runnerRank).toBe(2);
    expect(lore.runnerStatus.badgeLabel).toBe('RUNNER #2 (SECONDARY)');
    expect(lore.runnerStatus.badgeVariant).toBe('secondary');
    expect(lore.runnerStatus.timeDeltaAfterOgSec).toBe(1080);
    expect(lore.runnerStatus.explanation).toContain('18m after');
  });

  it('detects when a secondary runner has FLIPPED the original OG in market cap', async () => {
    const ogMint = 'OriginalSmallCapMintAddress1111111111111111';
    const flippedRunnerMint = 'FlippedBigCapRunnerAddress2222222222222222';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('api.dexscreener.com/latest/dex/search')) {
        return {
          ok: true,
          json: async () => ({
            pairs: [
              {
                chainId: 'solana',
                baseToken: { address: ogMint, symbol: 'NEIRO', name: 'Neiro OG' },
                pairCreatedAt: 1720000000000,
                marketCap: 10000000, // $10M
              },
              {
                chainId: 'solana',
                baseToken: { address: flippedRunnerMint, symbol: 'NEIRO', name: 'Neiro Flipper' },
                pairCreatedAt: 1720003600000, // 1 hour later
                marketCap: 120000000, // $120M (Flipped OG!)
              },
            ],
          }),
        } as any;
      }
      return { ok: false } as any;
    });

    const lore = await LoreService.getLoreForToken({
      mint: flippedRunnerMint,
      symbol: 'NEIRO',
      name: 'Neiro Flipper',
    });

    expect(lore.runnerStatus.isFirstRunner).toBe(false);
    expect(lore.runnerStatus.flippedOg).toBe(true);
    expect(lore.runnerStatus.explanation).toContain('FLIPPED the original');
  });

  it('synthesizes dynamic heuristic lore for unknown/newly launched tokens', async () => {
    // Unknown AI token
    const dynamicAiLore = await LoreService.getLoreForToken({
      mint: 'UnknownAiAgentMint1111111111111111111111111',
      symbol: 'CLAUDEBOT',
      name: 'Claude Autonomous Agent',
      marketCapUsd: 1500000,
    });

    expect(dynamicAiLore).toBeDefined();
    expect(dynamicAiLore.narrativeCategory).toBe('AI Agents & Bots');
    expect(dynamicAiLore.headline).toContain('Movement');
    expect(dynamicAiLore.whyItsFlying.length).toBeGreaterThan(0);
    expect(dynamicAiLore.viralityScore).toBeGreaterThanOrEqual(70);
  });
});
