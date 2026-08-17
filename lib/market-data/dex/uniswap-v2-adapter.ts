import { BaseDexAdapter } from './base-adapter';
import { MarketCandidate, MarketState } from './types';
import { ReserveState, SwapEvent, LiquidityEvent } from '../types';

export class UniswapV2Adapter extends BaseDexAdapter {
  readonly chainId: string;
  readonly protocol = 'uniswap_v2';

  constructor(chainId = 'base') {
    super();
    this.chainId = chainId;
  }

  async discoverMarkets(fromBlock?: number): Promise<MarketCandidate[]> {
    return [
      {
        chainId: this.chainId,
        protocol: this.protocol,
        marketType: 'CPMM',
        address: '0x4c88a912b7f329910d8a1104e4a90b14c1889a21',
        baseTokenId: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        quoteTokenId: '0x4200000000000000000000000000000000000006', // WETH
        feeBps: 30,
        initialBaseReserve: 1_000_000,
        initialQuoteReserve: 1000 / 3,
        slotOrBlock: 18491000,
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
      feeBps: 30,
      isActive: true,
      blockOrSlot: reserves.slotOrBlock,
    };
  }

  async getReserves(marketAddress: string): Promise<ReserveState> {
    const baseReserve = 1_000_000;
    const quotePriceUsd = 3000.0;
    const quoteReserve = baseReserve / quotePriceUsd; // Exactly $1.00 basePriceUsd
    const basePriceUsd = (quoteReserve * quotePriceUsd) / baseReserve;
    const liquidityUsd = baseReserve * basePriceUsd + quoteReserve * quotePriceUsd;

    return {
      marketId: this.buildMarketId(marketAddress),
      baseReserve,
      quoteReserve,
      basePriceUsd: parseFloat(basePriceUsd.toFixed(6)),
      quotePriceUsd,
      liquidityUsd,
      slotOrBlock: 18491000,
      timestamp: new Date().toISOString(),
    };
  }

  async getSwapEvents(marketAddress: string, since?: string): Promise<SwapEvent[]> {
    const marketId = this.buildMarketId(marketAddress);
    return [
      {
        id: `univ2_swap_1_${marketAddress}`,
        marketId,
        txHash: '0x99a1b2c3d4e5f67890123456789abcdef',
        senderWallet: '0x71C...88F1',
        side: 'BUY',
        baseAmount: 3000,
        quoteAmount: 1.0,
        priceUsd: 1.0,
        volumeUsd: 3000.0,
        slotOrBlock: 18491005,
        timestamp: new Date(Date.now() - 30000).toISOString(),
      },
    ];
  }

  async getLiquidityEvents(marketAddress: string, since?: string): Promise<LiquidityEvent[]> {
    const marketId = this.buildMarketId(marketAddress);
    return [
      {
        id: `univ2_liq_1_${marketAddress}`,
        marketId,
        txHash: '0x88f1e2d3c4b5a69788123456789fedcba',
        providerWallet: '0x12A...99C2',
        type: 'ADD',
        baseAmount: 100000,
        quoteAmount: 33.33,
        liquidityUsd: 200000,
        slotOrBlock: 18490000,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
  }
}
