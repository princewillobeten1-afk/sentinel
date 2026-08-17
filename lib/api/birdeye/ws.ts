export interface WsPriceSubscribePayload {
  type: 'SUBSCRIBE_PRICE';
  data: {
    queryType: 'simple' | 'complex';
    chartType?: string;
    address?: string; // For simple query
    currency?: 'usd' | 'pair';
    mode?: 'raw' | 'scaled' | 'both';
    query?: string; // For complex query
  };
}

export interface WsPriceDataResponse {
  type: 'PRICE_DATA';
  data: {
    eventType: 'ohlcv';
    type: string;
    unixTime: number;
    vUsd?: number;
    symbol?: string;
    address?: string;
    isScaled?: boolean;
    multiplier?: number | null;
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    scaledO?: number;
    scaledH?: number;
    scaledL?: number;
    scaledC?: number;
    scaledV?: number;
  };
}

export interface WsBaseQuotePriceSubscribePayload {
  type: 'SUBSCRIBE_BASE_QUOTE_PRICE';
  data: {
    baseAddress: string;
    quoteAddress: string;
    chartType: string;
    mode?: 'raw' | 'scaled' | 'both';
  };
}

export interface WsBaseQuotePriceDataResponse {
  type: 'BASE_QUOTE_PRICE_DATA';
  data: {
    eventType: 'ohlcv';
    type: string;
    unixTime: number;
    vUsd: number;
    baseAddress: string;
    quoteAddress: string;
    isScaledBase: boolean;
    isScaledQuote: boolean;
    multiplierBase: number | null;
    multiplierQuote: number | null;
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    scaledO?: number;
    scaledH?: number;
    scaledL?: number;
    scaledC?: number;
    scaledV?: number;
  };
}

export interface WsTxsSubscribePayload {
  type: 'SUBSCRIBE_TXS';
  data: {
    queryType: 'simple' | 'complex';
    address?: string;
    pairAddress?: string;
    query?: string;
    txsType?: 'all' | 'add_remove_liquidity' | 'add_liquidity' | 'remove_liquidity' | 'swap';
  };
}

export interface WsTxsDataResponse {
  type: 'TXS_DATA';
  data: {
    blockUnixTime: number;
    owner: string;
    source: string;
    txHash: string;
    side?: 'buy' | 'sell' | 'swap';
    tokenAddress?: string;
    alias?: string | null;
    isTradeOnBe?: boolean;
    platform?: string;
    pricePair?: number;
    volumeUSD?: number;
    from?: any;
    to?: any;
    priceMark?: boolean;
    tokenPrice?: number;
    network?: string;
    poolId?: string;
  };
}

export interface WsTokenNewListingSubscribePayload {
  type: 'SUBSCRIBE_TOKEN_NEW_LISTING';
  meme_platform_enabled?: boolean;
  min_liquidity?: number;
  max_liquidity?: number;
  sources?: string[];
}

export interface WsTokenNewListingDataResponse {
  type: 'TOKEN_NEW_LISTING_DATA';
  data: {
    address: string;
    decimals: number;
    name: string;
    symbol: string;
    liquidity: string;
    liquidityAddedAt: number;
  };
}

export interface WsNewPairSubscribePayload {
  type: 'SUBSCRIBE_NEW_PAIR';
  min_liquidity?: number;
  max_liquidity?: number;
}

export interface WsNewPairDataResponse {
  type: 'NEW_PAIR_DATA';
  data: {
    address: string;
    name: string;
    source: string;
    base: {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
    };
    quote: {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
    };
    txHash: string;
    blockTime: number;
  };
}

export interface WsLargeTradeSubscribePayload {
  type: 'SUBSCRIBE_LARGE_TRADE_TXS';
  min_volume: number;
  max_volume?: number;
}

export interface WsLargeTradeDataResponse {
  type: 'TXS_LARGE_TRADE_DATA';
  data: {
    blockUnixTime: number;
    blockHumanTime: string;
    owner: string;
    source: string;
    poolAddress: string;
    txHash: string;
    volumeUSD: number;
    network: string;
    from: any;
    to: any;
  };
}

export interface WsWalletTxsSubscribePayload {
  type: 'SUBSCRIBE_WALLET_TXS';
  data: {
    address: string;
  };
}

export interface WsWalletTxsUnsubscribePayload {
  type: 'UNSUBSCRIBE_WALLET_TXS';
}

export interface WsWalletTxsDataResponse {
  type: 'WALLET_TXS_DATA';
  data: {
    type: string;
    blockUnixTime: number;
    blockHumanTime: string;
    owner: string;
    source: string;
    txHash: string;
    volumeUSD: number;
    network: string;
    base: any;
    quote: any;
  };
}

export interface WsTokenStatsSubscribePayload {
  type: 'SUBSCRIBE_TOKEN_STATS';
  data: {
    address: string | string[];
    select: {
      price?: boolean;
      trade_data?: {
        volume?: boolean;
        trade?: boolean;
        price_history?: boolean;
        volume_history?: boolean;
        price_change?: boolean;
        trade_history?: boolean;
        trade_change?: boolean;
        volume_change?: boolean;
        unique_wallet?: boolean;
        unique_wallet_change?: boolean;
        intervals?: string[];
      };
      fdv?: boolean;
      marketcap?: boolean;
      supply?: boolean;
      last_trade?: boolean;
      liquidity?: boolean;
    };
  };
}

export interface WsTokenStatsUnsubscribePayload {
  type: 'UNSUBSCRIBE_TOKEN_STATS';
  data: {
    address: string | string[];
  };
}

export interface WsTokenStatsDataResponse {
  type: 'TOKEN_STATS_DATA';
  data: Record<string, any>;
}

export interface WsMemeSubscribePayload {
  type: 'SUBSCRIBE_MEME';
  data: {
    address?: string;
    graduated?: boolean;
    source?: string;
    progress_percent?: { min: number; max: number };
    creation_time?: { from: number; to: number };
    graduated_time?: { from: number; to: number };
    intervals?: string[];
  };
}

export interface WsMemeDataResponse {
  type: 'MEME_DATA';
  data: Record<string, any>;
}

export interface WsTransferSubscribePayload {
  type: 'SUBSCRIBE_TRANSFER';
  data: {
    filters: Array<{
      wallet_addresses: string[];
      flow?: 'in' | 'out';
      token_addresses?: string[];
      ui_amount_min?: number;
      ui_amount_max?: number;
      value_min?: number;
      value_max?: number;
    }>;
  };
}

export interface WsTransferDataResponse {
  type: 'TRANSFER_DATA';
  data: {
    block_number: number;
    unix_time: number;
    token_address: string;
    from_address: string;
    to_address: string;
    from_token_account: string;
    to_token_account: string;
    amount: number;
    ui_amount: number;
    price: number;
    value: number;
    token_decimals: number;
    tx_hash: string;
    action: string;
    ins_index: number;
    inner_index: number;
    network: string;
  };
}

type WsPayload =
  | WsPriceSubscribePayload
  | WsBaseQuotePriceSubscribePayload
  | WsTxsSubscribePayload
  | WsTokenNewListingSubscribePayload
  | WsNewPairSubscribePayload
  | WsLargeTradeSubscribePayload
  | WsWalletTxsSubscribePayload
  | WsWalletTxsUnsubscribePayload
  | WsTokenStatsSubscribePayload
  | WsTokenStatsUnsubscribePayload
  | WsMemeSubscribePayload
  | WsTransferSubscribePayload;

export type WsResponse =
  | WsPriceDataResponse
  | WsBaseQuotePriceDataResponse
  | WsTxsDataResponse
  | WsTokenNewListingDataResponse
  | WsNewPairDataResponse
  | WsLargeTradeDataResponse
  | WsWalletTxsDataResponse
  | WsTokenStatsDataResponse
  | WsMemeDataResponse
  | WsTransferDataResponse;

export type MessageHandler = (data: WsResponse) => void;

export class BirdeyeWSClient {
  private readonly baseUrl = 'wss://public-api.birdeye.so/socket';
  private ws: WebSocket | null = null;
  private apiKey: string;
  private chain: string;
  private reconnecting: boolean = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private handlers: Set<MessageHandler> = new Set();
  
  // Track active subscriptions for automatic resubscription on reconnect
  private activeSubscriptions: Map<string, WsPayload> = new Map();

  constructor(apiKey?: string, chain: string = 'solana') {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_BIRDEYE_API_KEY || process.env.BIRDEYE_API_KEY || '';
    this.chain = chain;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      if (typeof window === 'undefined') {
        // Node.js environment
        const WebSocketClass = require('ws');
        this.ws = new WebSocketClass(`${this.baseUrl}/${this.chain}?x-api-key=${this.apiKey}`, 'echo-protocol', {
          headers: {
            'Origin': 'ws://public-api.birdeye.so',
          }
        }) as unknown as WebSocket;
      } else {
        // Browser environment
        this.ws = new WebSocket(`${this.baseUrl}/${this.chain}?x-api-key=${this.apiKey}`, 'echo-protocol');
      }

      this.ws!.onopen = () => {
        this.reconnectAttempts = 0;
        this.reconnecting = false;
        
        // Resubscribe to active subscriptions on successful connection
        for (const payload of this.activeSubscriptions.values()) {
          this.ws!.send(JSON.stringify(payload));
        }
        resolve();
      };

      this.ws!.onmessage = (event: MessageEvent) => {
        try {
          const data: WsResponse = JSON.parse(event.data.toString());
          this.handlers.forEach(handler => handler(data));
        } catch (error) {
          console.error('Failed to parse Birdeye WebSocket message', error);
        }
      };

      this.ws!.onclose = () => {
        if (!this.reconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };

      this.ws!.onerror = (error) => {
        console.error('Birdeye WebSocket Error:', error);
        if (this.ws!.readyState === WebSocket.CONNECTING) {
          reject(new Error('WebSocket connection failed'));
        }
      };
    });
  }

  private attemptReconnect() {
    this.reconnecting = true;
    this.reconnectAttempts++;
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    setTimeout(() => {
      this.connect().catch(() => {
        // Continue retrying via onclose logic
      });
    }, backoff);
  }

  public subscribe(payload: WsPayload) {
    // Store in active subscriptions map to resubscribe on reconnect
    const subKey = JSON.stringify(payload);
    this.activeSubscriptions.set(subKey, payload);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.connect(); // Connect will automatically flush activeSubscriptions on open
    }
  }

  public unsubscribe(payload: WsPayload) {
    const subKey = JSON.stringify(payload);
    this.activeSubscriptions.delete(subKey);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public addHandler(handler: MessageHandler) {
    this.handlers.add(handler);
  }

  public removeHandler(handler: MessageHandler) {
    this.handlers.delete(handler);
  }

  public disconnect() {
    this.activeSubscriptions.clear();
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
