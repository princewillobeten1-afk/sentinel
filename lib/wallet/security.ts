import { TransactionIntent } from '../transaction/simulator';

export interface SecurityCheckResult {
  isSafe: boolean;
  riskLevel: 'safe' | 'warning' | 'critical';
  warnings: string[];
}

export class WalletSecurityLayer {
  
  async analyzeTransaction(intent: TransactionIntent, targetContract: string): Promise<SecurityCheckResult> {
    const warnings: string[] = [];
    let riskLevel: 'safe' | 'warning' | 'critical' = 'safe';

    // Anti-phishing: Verify target contract
    const isKnownContract = await this.verifyContract(targetContract);
    if (!isKnownContract) {
      warnings.push(`Target contract ${targetContract} is unknown or unverified.`);
      riskLevel = 'warning';
    }

    // Unexpected transfers check
    if (intent.action !== 'BUY' && intent.action !== 'SELL' && intent.action !== 'SWAP' && intent.action !== 'TRANSFER') {
      warnings.push(`Unusual transaction intent detected: ${intent.action}`);
      riskLevel = riskLevel === 'safe' ? 'warning' : 'critical';
    }

    // Approval tracking
    if (intent.action === 'APPROVE') {
      if (intent.amountIn === Number.MAX_SAFE_INTEGER || intent.amountIn > 1_000_000_000) {
        warnings.push('Warning: Requesting a virtually unlimited token allowance.');
        riskLevel = 'critical';
      }
    }

    return {
      isSafe: riskLevel !== 'critical',
      riskLevel,
      warnings
    };
  }

  private async verifyContract(address: string): Promise<boolean> {
    // Mock implementation for MVP
    // In production, cross-reference against a known registry of DEX programs, token contracts, etc.
    const knownContracts = [
      'JUP6LkbZbjS1jKKwapdH67y95yW1QnNn2nNn2nNn2nNn', // Mock Jupiter
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'   // Token Program
    ];
    return knownContracts.includes(address) || address.length < 40; // naive mock
  }
}
