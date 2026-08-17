import { describe, it, expect, beforeEach } from 'vitest';
import { TokenDiscoveryService, tokenDiscoveryService } from '../token-discovery';
import { MarketDiscoveryService, marketDiscoveryService } from '../market-discovery';
import { eventBus } from '@/lib/events/bus';

describe('Sprint 44: Token & Market Discovery Pipeline', () => {
  beforeEach(() => {
    tokenDiscoveryService.reset();
    marketDiscoveryService.reset();
  });

  it('discovers new valid Solana and EVM token candidates and transitions statuses', async () => {
    // 1. Valid Solana token candidate
    const solToken = await tokenDiscoveryService.processCandidate({
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      chainId: 'solana',
      symbol: 'BONK',
      name: 'Bonk',
      decimals: 5,
      source: 'raydium_swap',
    });

    expect(solToken.status).toBe('VALIDATED');
    expect(solToken.symbol).toBe('BONK');
    expect(solToken.decimals).toBe(5);

    // 2. Valid EVM token candidate
    const evmToken = await tokenDiscoveryService.processCandidate({
      address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', // PEPE
      chainId: 'ethereum',
      symbol: 'PEPE',
      name: 'Pepe',
      decimals: 18,
      source: 'uniswap_v2_pair',
    });

    expect(evmToken.status).toBe('VALIDATED');
    expect(evmToken.symbol).toBe('PEPE');
  });

  it('marks malformed token addresses or invalid decimals as SUSPICIOUS', async () => {
    const suspiciousToken = await tokenDiscoveryService.processCandidate({
      address: 'invalid-address-format-too-short',
      chainId: 'solana',
      symbol: 'SCAM',
      name: 'Scam Token',
      decimals: 25, // Invalid decimals (> 18)
      source: 'unknown',
    });

    expect(suspiciousToken.status).toBe('SUSPICIOUS');
  });

  it('supports UnknownAsset fallback without throwing or interrupting the pipeline', async () => {
    const unknownToken = await tokenDiscoveryService.processCandidate({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chainId: 'solana',
      source: 'unparsed_transfer',
    });

    expect(unknownToken.status).toBe('DISCOVERED');
    expect(unknownToken.symbol).toBe('UNKNOWN');
    expect(unknownToken.name).toContain('Unknown Asset');
  });

  it('handles metadata enrichment failures gracefully without discarding the token', async () => {
    const token = await tokenDiscoveryService.processCandidate({
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R_fail',
      chainId: 'solana',
      source: 'event',
    });

    await tokenDiscoveryService.enrichMetadataAsync('solana', token.address);

    expect(token.metadataStatus).toBe('FAILED');
    expect(token.enrichmentError).toBeDefined();
    // Token is still in registry
    const fetched = tokenDiscoveryService.getToken('solana', '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R_fail');
    expect(fetched).not.toBeNull();
  });

  it('discovers and deduplicates DEX liquidity markets across protocols', async () => {
    // 1. Initial market discovery
    const market = await marketDiscoveryService.registerMarket({
      chainId: 'solana',
      address: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      protocol: 'raydium_amm',
      baseTokenAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      baseTokenSymbol: 'BONK',
      quoteTokenAddress: 'So11111111111111111111111111111111111111112',
      quoteTokenSymbol: 'SOL',
      initialLiquidityUsd: 1500000,
      initialPrice: 0.000025,
    });

    expect(market.id).toBeDefined();
    expect(market.liquidityUsd).toBe(1500000);
    expect(market.price).toBe(0.000025);

    // 2. Duplicate registration attempt should return existing market without duplication
    const duplicate = await marketDiscoveryService.registerMarket({
      chainId: 'solana',
      address: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      protocol: 'raydium_amm',
      baseTokenAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      quoteTokenAddress: 'So11111111111111111111111111111111111111112',
    });

    expect(duplicate.id).toBe(market.id);
    expect(marketDiscoveryService.getAllMarkets('solana').length).toBe(1);
  });
});
