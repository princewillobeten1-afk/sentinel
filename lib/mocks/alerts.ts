import { AlertCardData } from '@/components/ui/alert-card';

export const mockAlerts: AlertCardData[] = [
  {
    id: 'a1',
    type: 'Coordinated Ownership Cluster',
    severity: 'critical',
    timestamp: '2m ago',
    tokenSymbol: '$SOLM',
    tokenName: 'Solana Meme',
    description: '17 top holder wallets funded by 3 connected deposit addresses within 22 minutes.',
    evidence: 'Cluster controls 31.4% of total supply. High dump probability detected.',
    actionText: 'Inspect Wallet Graph',
  },
  {
    id: 'a2',
    type: 'Insider Liquidity Transfer',
    severity: 'high',
    timestamp: '14m ago',
    tokenSymbol: '$CYBER',
    tokenName: 'Cyber Core AI',
    description: 'Deployer wallet transferred 12% total supply to Raydium router.',
    evidence: 'Deployer past rug rate: 1/5 past tokens.',
    actionText: 'Review Creator History',
  },
  {
    id: 'a3',
    type: 'Wash Trading Volume Discrepancy',
    severity: 'medium',
    timestamp: '42m ago',
    tokenSymbol: '$PUMPX',
    tokenName: 'Pump X Token',
    description: '3 automated bot addresses generating 82% of raw transaction volume through circular trades.',
    evidence: 'Real organic volume estimated at $12K instead of $450K displayed.',
    actionText: 'Filter Organic Volume',
  },
];
