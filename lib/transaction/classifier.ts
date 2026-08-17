/**
 * Multi-Chain Transaction Classifier (Sprint 44 §62-64).
 *
 * Classifies normalized transactions into standard transaction archetypes:
 *   - TRANSFER, SWAP, LIQUIDITY_ADD, LIQUIDITY_REMOVE, MINT, BURN, CONTRACT_INTERACTION, UNKNOWN
 * Stores confidence score (0.0 - 1.0), detection source, and classifier rule version.
 */

import { TransactionClassification, TransactionClassificationType, SupportedChain } from '@/lib/blockchain/types';

export interface ClassificationInput {
  chainId: SupportedChain;
  from: string;
  to: string | null;
  data?: string;
  logs?: string[];
  programId?: string;
  valueFormatted?: number;
}

export function classifyTransaction(input: ClassificationInput): TransactionClassification {
  const version = 'v1.0.0';

  // 1. Solana checks
  if (input.chainId === 'solana') {
    const logs = input.logs || [];
    const logsText = logs.join(' ').toLowerCase();

    if (logsText.includes('ray_log') || logsText.includes('swap') || logsText.includes('route')) {
      return {
        type: 'SWAP',
        confidence: 0.95,
        source: 'solana_program_log_signature',
        version,
      };
    }

    if (logsText.includes('initialize2') || logsText.includes('addliquidity') || logsText.includes('deposit')) {
      return {
        type: 'LIQUIDITY_ADD',
        confidence: 0.9,
        source: 'solana_dex_liquidity_event',
        version,
      };
    }

    if (logsText.includes('withdraw') || logsText.includes('removeliquidity')) {
      return {
        type: 'LIQUIDITY_REMOVE',
        confidence: 0.9,
        source: 'solana_dex_liquidity_event',
        version,
      };
    }

    if (logsText.includes('mintto') || logsText.includes('mint_to')) {
      return {
        type: 'MINT',
        confidence: 0.92,
        source: 'spl_token_mint_event',
        version,
      };
    }

    if (logsText.includes('burntot') || logsText.includes('burn')) {
      return {
        type: 'BURN',
        confidence: 0.92,
        source: 'spl_token_burn_event',
        version,
      };
    }

    if (logsText.includes('transfer') || (input.valueFormatted && input.valueFormatted > 0)) {
      return {
        type: 'TRANSFER',
        confidence: 0.88,
        source: 'solana_system_or_spl_transfer',
        version,
      };
    }

    if (logs.length > 0) {
      return {
        type: 'CONTRACT_INTERACTION',
        confidence: 0.75,
        source: 'solana_program_execution',
        version,
      };
    }

    return {
      type: 'UNKNOWN',
      confidence: 0.1,
      source: 'unclassified_solana_activity',
      version,
    };
  }

  // 2. EVM checks (Ethereum, Base)
  const data = (input.data || '0x').toLowerCase();

  // Common ERC20 / Uniswap 4-byte function selectors
  // 0xa9059cbb: transfer(address,uint256)
  // 0x23b872dd: transferFrom(address,address,uint256)
  // 0x38ed1739: swapExactTokensForTokens
  // 0x7ff36ab5: swapExactETHForTokens
  // 0x18cbafe5: swapExactTokensForETH
  // 0xe8e33700: addLiquidity
  // 0xf305d719: addLiquidityETH
  // 0xbaa2abde: removeLiquidity
  // 0x02751dac: removeLiquidityETH
  // 0x40c10f19: mint(address,uint256)
  // 0x42966c68: burn(uint256)

  if (
    data.startsWith('0x38ed1739') ||
    data.startsWith('0x7ff36ab5') ||
    data.startsWith('0x18cbafe5') ||
    data.startsWith('0x5c11d795') || // swapExactTokensForTokensSupportingFeeOnTransferTokens
    data.startsWith('0xb6f9de95') || // swapExactETHForTokensSupportingFeeOnTransferTokens
    data.startsWith('0x791ac947') // swapExactTokensForETHSupportingFeeOnTransferTokens
  ) {
    return {
      type: 'SWAP',
      confidence: 0.98,
      source: 'evm_router_function_selector',
      version,
    };
  }

  if (data.startsWith('0xe8e33700') || data.startsWith('0xf305d719')) {
    return {
      type: 'LIQUIDITY_ADD',
      confidence: 0.98,
      source: 'evm_router_function_selector',
      version,
    };
  }

  if (data.startsWith('0xbaa2abde') || data.startsWith('0x02751dac')) {
    return {
      type: 'LIQUIDITY_REMOVE',
      confidence: 0.98,
      source: 'evm_router_function_selector',
      version,
    };
  }

  if (data.startsWith('0x40c10f19')) {
    return {
      type: 'MINT',
      confidence: 0.95,
      source: 'erc20_mint_selector',
      version,
    };
  }

  if (data.startsWith('0x42966c68')) {
    return {
      type: 'BURN',
      confidence: 0.95,
      source: 'erc20_burn_selector',
      version,
    };
  }

  if (data.startsWith('0xa9059cbb') || data.startsWith('0x23b872dd')) {
    return {
      type: 'TRANSFER',
      confidence: 0.96,
      source: 'erc20_transfer_selector',
      version,
    };
  }

  // Plain native ETH transfer with empty data
  if (data === '0x' || data === '') {
    if (input.valueFormatted && input.valueFormatted > 0) {
      return {
        type: 'TRANSFER',
        confidence: 0.99,
        source: 'native_eth_transfer',
        version,
      };
    }
  }

  // Generic contract interaction
  if (data.length > 2) {
    return {
      type: 'CONTRACT_INTERACTION',
      confidence: 0.7,
      source: 'evm_custom_calldata',
      version,
    };
  }

  return {
    type: 'UNKNOWN',
    confidence: 0.2,
    source: 'unclassified_evm_transaction',
    version,
  };
}
