export type TrackedWalletCategory = 'SMART_MONEY' | 'WHALE' | 'KOL' | 'INSIDER' | 'SNIPER' | 'DEV' | 'GENERAL';

export interface TrackedWallet {
  address: string;
  label: string;
  category: TrackedWalletCategory;
  notes?: string;
  solBalance?: number;
  winRate?: number;
  totalRealizedPnlUsd?: number;
  totalTradesCount?: number;
  tags?: string[];
  addedAt: string;
  lastActiveAt?: string;
  alertEnabled?: boolean;
  minAlertTradeUsd?: number;
}

export interface TrackedWalletTrade {
  id: string;
  walletAddress: string;
  walletLabel?: string;
  walletCategory?: TrackedWalletCategory;
  action: 'BUY' | 'SELL';
  tokenMint: string;
  tokenSymbol: string;
  tokenName?: string;
  tokenLogo?: string;
  amountSol: number;
  valueUsd: number;
  priceUsd: number;
  timestamp: string;
  txHash: string;
}

// Initial seed smart-money wallets so the dashboard feels alive immediately
export const INITIAL_TRACKED_WALLETS: TrackedWallet[] = [
  {
    address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    label: 'Raydium Alpha Trench Sniper',
    category: 'SMART_MONEY',
    notes: 'Consistently buys within 3 minutes of bonding curve migration with 82% win rate.',
    solBalance: 482.5,
    winRate: 82.4,
    totalRealizedPnlUsd: 384500,
    totalTradesCount: 420,
    tags: ['Early Buyer', 'High Win-rate'],
    addedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    alertEnabled: true,
    minAlertTradeUsd: 500,
  },
  {
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    label: 'Whale Multi-Pool Accumulator',
    category: 'WHALE',
    notes: 'Large position builder on mid-cap ecosystem runners ($100k-$500k allocations).',
    solBalance: 2450.8,
    winRate: 74.1,
    totalRealizedPnlUsd: 1250000,
    totalTradesCount: 188,
    tags: ['Whale', 'Swing Trader'],
    addedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    alertEnabled: true,
    minAlertTradeUsd: 2500,
  },
  {
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    label: 'Solana KOL Alpha Scout (@hako99)',
    category: 'KOL',
    notes: 'Public caller with proven audited wallet track record; rarely roundtrips.',
    solBalance: 128.4,
    winRate: 78.5,
    totalRealizedPnlUsd: 198400,
    totalTradesCount: 310,
    tags: ['KOL Verified', 'Momentum'],
    addedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    alertEnabled: true,
    minAlertTradeUsd: 200,
  },
  {
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    label: 'Meteora DLMM Scalper',
    category: 'SNIPER',
    notes: 'Micro-scalps high-volatility pairs with dynamic fee capture.',
    solBalance: 95.2,
    winRate: 69.8,
    totalRealizedPnlUsd: 84200,
    totalTradesCount: 654,
    tags: ['Scalper', 'High Frequency'],
    addedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 62).toISOString(),
    alertEnabled: false,
    minAlertTradeUsd: 100,
  },
];

export const INITIAL_LIVE_TRADES: TrackedWalletTrade[] = [
  {
    id: 'tr_1',
    walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    walletLabel: 'Raydium Alpha Trench Sniper',
    walletCategory: 'SMART_MONEY',
    action: 'BUY',
    tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    tokenSymbol: 'BONK',
    tokenName: 'Bonk',
    tokenLogo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cDc7I',
    amountSol: 15.0,
    valueUsd: 2280,
    priceUsd: 0.0000248,
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    txHash: '5x9YvB7M3q...8N2p',
  },
  {
    id: 'tr_2',
    walletAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    walletLabel: 'Whale Multi-Pool Accumulator',
    walletCategory: 'WHALE',
    action: 'BUY',
    tokenMint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump',
    tokenSymbol: 'SENT',
    tokenName: 'Project Sentinel',
    tokenLogo: '/icons/sentinel.png',
    amountSol: 45.0,
    valueUsd: 6840,
    priceUsd: 0.042,
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    txHash: '3mK8sL2Q9x...4Rt1',
  },
  {
    id: 'tr_3',
    walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    walletLabel: 'Solana KOL Alpha Scout',
    walletCategory: 'KOL',
    action: 'SELL',
    tokenMint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    tokenSymbol: 'WIF',
    tokenName: 'dogwifhat',
    tokenLogo: 'https://bafkreibk3covs5ltyqxa272uodhculbx6uh3h52cwopx6rh2i33rq55iaa.ipfs.nftstorage.link',
    amountSol: 18.5,
    valueUsd: 2812,
    priceUsd: 2.14,
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    txHash: '4nL7vC9P2q...9Km5',
  },
  {
    id: 'tr_4',
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    walletLabel: 'Meteora DLMM Scalper',
    walletCategory: 'SNIPER',
    action: 'BUY',
    tokenMint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    tokenSymbol: 'MEW',
    tokenName: 'cat in a dogs world',
    tokenLogo: 'https://bafybeicg5z3oxcbgq32h72xey4i5qquu65t4v4kexnfdx5u2p47m53m5re.ipfs.nftstorage.link',
    amountSol: 8.0,
    valueUsd: 1216,
    priceUsd: 0.0054,
    timestamp: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    txHash: '2pK9vL4M8q...7Nz2',
  },
];
