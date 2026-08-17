import { BaseDexAdapter } from './base-adapter';
import { MarketCandidate, MarketState } from './types';
import { ReserveState, SwapEvent, LiquidityEvent } from '../types';

export class UniswapV3Adapter extends BaseDexAdapter {
  readonly chainId: string;
  readonly protocol = 'uniswap_v3';

  constructor(chainId = 'ethereum') {
    super();
    this.chainId = chainId;
  }

  async discoverMarkets(fromBlock?: number): Promise<MarketCandidate[]> {
    return [
      {
        chainId: this.chainId,
        protocol: this.protocol,
        marketType: 'CONCENTRATED',
        address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
        baseTokenId: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        quoteTokenId: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        feeBps: 5, // 0.05%
        initialBaseReserve: 15_000_000,
        initialQuoteReserve: 5_000,
        slotOrBlock: 19820000,
        metadata: { tickSpacing: 10, currentTick: 200420 },
      },
    ];
  }

  async getMarketState(marketAddress: string): Promise<MarketState> {
    const reserves = await this.getReserves(marketAddress);
    return {
      marketId: this.buildMarketId(marketAddress),
      address: marketAddress,
      reserves,
      currentPriceUsd: reserves.basePriceUsd,
      feeBps: 5,
      isActive: true,
      blockOrSlot: reserves.slotOrBlock,
    };
  }

  async getReserves(marketAddress: string): Promise<ReserveState> {
    const baseReserve = 15_000_000;
    const quoteReserve = 5_000; // At $3,000 WETH
    const quotePriceUsd = 3000.0;
    const basePriceUsd = 1.0;
    const liquidityUsd = baseReserve * basePriceUsd + quoteReserve * quotePriceUsd;

    return {
      marketId: this.buildMarketId(marketAddress),
      baseReserve,
      quoteReserve,
      basePriceUsd,
      quotePriceUsd,
      liquidityUsd,
      slotOrBlock: 19820000,
      timestamp: new Date().toISOString(),
    };
  }

  async getSwapEvents(marketAddress: string, since?: string): Promise<SwapEvent[]> {
    const marketId = this.buildMarketId(marketAddress);
    return [
      {
        id: `univ3_swap_1_${marketAddress}`,
        marketId,
        txHash: '0x11223344556677889900aabbccddeeff11223344',
        senderWallet: '0xWhale...33A1',
        side: 'SELL',
        baseAmount: 150000,
        quoteAmount: 50.0,
        priceUsd: 1.0,
        volumeUsd: 150000.0,
        slotOrBlock: 19820050,
        timestamp: new Date(Date.now() - 15000).toISOString(),
      },
    ];
  }

  async getLiquidityEvents(marketAddress: string, since?: string): Promise<LiquidityEvent[]> {
    const marketId = this.buildMarketId(marketAddress);
    return [
      {
        id: `univ3_liq_1_${marketAddress}`,
        marketId,
        txHash: '0xaabbccddeeff00112233445566778899aabbccdd',
        providerWallet: '0xMarketMaker...9900',
        type: 'ADD',
        baseAmount: 500000,
        quoteAmount: 166.66,
        liquidityUsd: 1000000,
        slotOrBlock: 19819900,
        timestamp: new Date(Date.now() - 14400000).toISOString(),
      },
    ];
  }
}
