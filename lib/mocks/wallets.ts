import { WalletCardData } from '@/components/ui/wallet-card';

export const mockWallets: WalletCardData[] = [
  {
    address: '4zW8...9kL2',
    label: 'Smart Money Cluster #1',
    balanceSol: 1420.5,
    balanceUsd: '$202,421',
    reputation: 'Smart Money',
    winRate: '78.4%',
    recentActivity: 'Bought 2.5 SOL $SENT 12s ago',
  },
  {
    address: '7xK9...2mP1',
    label: 'Insider Deployer 7xK9',
    balanceSol: 42.8,
    balanceUsd: '$6,099',
    reputation: 'Insider',
    winRate: '42.1%',
    recentActivity: 'Transferred 12% supply to DEX router',
  },
  {
    address: '1aM3...2b88',
    label: 'Whale Accumulator X',
    balanceSol: 8920.0,
    balanceUsd: '$1,271,100',
    reputation: 'Whale',
    winRate: '84.2%',
    recentActivity: 'Bought 5.0 SOL $SENT 42s ago',
  },
];
