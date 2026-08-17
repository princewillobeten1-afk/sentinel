import { describe, it, expect, beforeEach } from 'vitest';
import { tokenDiscoveryPipeline } from '../discovery/token-discovery-pipeline';
import { canonicalMarketRegistry } from '../discovery/market-registry';
import { poolDiscoveryPipeline } from '../discovery/pool-discovery-pipeline';
import { priceEngine } from '../pricing/price-engine';
import { liquidityEngine } from '../liquidity/liquidity-engine';
import { volumeEngine } from '../volume/volume-engine';
import { ohlcvEngine } from '../ohlcv/ohlcv-engine';
import { snapshotEngine } from '../snapshots/snapshot-engine';
import { rankingEngine } from '../rankings/ranking-engine';
import { tokenSearchEngine } from '../rankings/search-engine';
import { marketDataQualityService } from '../quality/quality-service';
import { realtimeMarketPublisher } from '../realtime/realtime-publisher';

describe('Sprint 45 End-to-End Market Data Engine Acceptance Test (§94)', () => {
  beforeEach(() => {
    tokenDiscoveryPipeline.reset();
    canonicalMarketRegistry.reset();
    priceEngine.reset();
    liquidityEngine.reset();
    volumeEngine.reset();
    ohlcvEngine.reset();
    snapshotEngine.reset();
    realtimeMarketPublisher.reset();
  });

  it('executes full pipeline: Token -> Discovery -> Pool -> Reserves -> Swaps -> OHLCV -> Snapshots -> Ranking -> WS', async () => {
    // 1. Token Created & Discovered
    const testMint = '7xK9FixturedAcceptanceTokenMint99a1';
    const quoteMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC

    const token = tokenDiscoveryPipeline.registerOrUpdateToken({
      tokenId: testMint,
      chainId: 'solana',
      symbol: 'FIXTURE',
      name: 'Fixture Protocol Token',
      decimals: 9,
      totalSupply: 10_000_000,
      circulatingSupply: 7_500_000,
      maxSupply: 10_000_000,
      supplyConfidence: 0.95,
    });
    expect(token.tokenId).toBe(testMint);

    // 2. Pool Discovery Pipeline: Discovers Raydium CPMM Pool
    const poolCandidate = {
      chainId: 'solana',
      protocol: 'raydium_cpmm',
      marketType: 'CPMM' as const,
      address: 'PoolRaydiumFixture001',
      baseTokenId: testMint,
      quoteTokenId: quoteMint,
      feeBps: 25,
    };

    const discoveryResult = poolDiscoveryPipeline.processCandidate(poolCandidate);
    expect(discoveryResult.validation.isValid).toBe(true);
    expect(discoveryResult.market.status).toBe('ACTIVE');

    const marketId = discoveryResult.market.marketId;

    // 3. Liquidity Added (Reserves Set)
    const baseReserve = 50_000;
    const quoteReserve = 100_000; // Price = $2.00
    const quotePriceUsd = 1.0;
    const basePriceUsd = quoteReserve / baseReserve;
    const liquidityUsd = baseReserve * basePriceUsd + quoteReserve * quotePriceUsd;

    liquidityEngine.setMarketReserve({
      marketId,
      baseReserve,
      quoteReserve,
      basePriceUsd,
      quotePriceUsd,
      liquidityUsd,
      slotOrBlock: 1000,
      timestamp: new Date().toISOString(),
    });

    priceEngine.setMarketPrice({
      marketId,
      priceUsd: basePriceUsd,
      status: 'FRESH',
      source: 'ONCHAIN',
      confidence: 0.98,
      liquidityUsd,
      volume24hUsd: 0,
      timestamp: new Date().toISOString(),
    });

    // 4. Swaps Executed
    const swap = {
      id: 'swap_acceptance_1',
      marketId,
      txHash: '0xAcceptanceTx1',
      senderWallet: 'TraderWallet1',
      side: 'BUY' as const,
      baseAmount: 1000,
      quoteAmount: 2050,
      priceUsd: 2.05,
      volumeUsd: 2050,
      slotOrBlock: 1005,
      timestamp: new Date().toISOString(),
    };

    volumeEngine.ingestSwap(swap);
    ohlcvEngine.processTrade(swap);

    // 5. OHLCV Candle generated
    const candles = ohlcvEngine.getCandles(marketId, '1m', 10);
    expect(candles.length).toBeGreaterThan(0);
    expect(candles[candles.length - 1].close).toBe(2.05);

    // 6. Token Market Snapshot computed
    const snapshot = snapshotEngine.computeTokenSnapshot(testMint);
    expect(snapshot.priceUsd).toBe(2.0);
    expect(snapshot.marketCapUsd).toBe(7_500_000 * 2.0); // 15M MCAP
    expect(snapshot.totalLiquidityUsd).toBe(200_000);

    // 7. Token Quality Evaluated
    const quality = marketDataQualityService.evaluateTokenQuality(testMint);
    expect(quality.dataQualityScore).toBeGreaterThan(70);
    expect(quality.divergenceStatus).toBe('NORMAL');

    // 8. Token Search Finds Token
    const searchRes = tokenSearchEngine.search('FIXTURE');
    expect(searchRes.items.length).toBeGreaterThan(0);
    expect(searchRes.items[0].symbol).toBe('FIXTURE');

    // 9. Realtime WebSocket Broadcast
    let wsBroadcastReceived: any = null;
    const unsub = realtimeMarketPublisher.subscribe(
      `token.market_data_updated:${testMint}`,
      (data) => {
        wsBroadcastReceived = data;
      }
    );

    realtimeMarketPublisher.publishTokenUpdate(testMint, snapshot);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(wsBroadcastReceived).toBeDefined();
    expect(wsBroadcastReceived.tokenId).toBe(testMint);

    unsub();
  });
});
