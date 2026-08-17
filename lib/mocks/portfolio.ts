export interface Position {
  id: string;
  symbol: string;
  name: string;
  amount: string;
  avgEntry: string;
  currentPrice: string;
  grossPnl: string;
  netPnl: string;
  feesPaid: string;
  riskStatus: string;
}

export const mockPositions: Position[] = [
  {
    id: 'p1',
    symbol: '$SENT',
    name: 'Solana Sentinel',
    amount: '142,500.00',
    avgEntry: '$0.0310',
    currentPrice: '$0.0425',
    grossPnl: '+$1,638.75',
    netPnl: '+$1,582.10',
    feesPaid: '$56.65',
    riskStatus: 'Safe',
  },
  {
    id: 'p2',
    symbol: '$CYBER',
    name: 'Cyber Core AI',
    amount: '24,000.00',
    avgEntry: '$0.1500',
    currentPrice: '$0.1850',
    grossPnl: '+$840.00',
    netPnl: '+$812.40',
    feesPaid: '$27.60',
    riskStatus: 'Low',
  },
];
