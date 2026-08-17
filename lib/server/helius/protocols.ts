/**
 * Verified Official Solana Protocol Program IDs.
 *
 * Sourced from official protocol documentation and verified on-chain deployments.
 * Documented in one centralized configuration file for all decoders and filters.
 */

export interface ProtocolConfig {
  name: string;
  programId: string;
  category: 'launchpad' | 'amm' | 'clmm' | 'dlmm';
  enabled: boolean;
}

export const PROTOCOL_PROGRAMS: Record<string, ProtocolConfig> = {
  pumpfun: {
    name: 'Pump.fun Bonding Curve',
    programId: process.env.PUMPFUN_PROGRAM_ID || '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    category: 'launchpad',
    enabled: true,
  },
  pumpAmm: {
    name: 'Pump AMM',
    programId: process.env.PUMP_AMM_PROGRAM_ID || 'BSfD6SHZigAfDWSQu55ngtcKyQnCojN8N4ahVaBXU6C',
    category: 'amm',
    enabled: true,
  },
  raydiumAmmV4: {
    name: 'Raydium AMM V4',
    programId: process.env.RAYDIUM_AMM_V4_PROGRAM_ID || '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    category: 'amm',
    enabled: true,
  },
  raydiumCpmm: {
    name: 'Raydium CPMM',
    programId: process.env.RAYDIUM_CPMM_PROGRAM_ID || 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
    category: 'amm',
    enabled: true,
  },
  raydiumClmm: {
    name: 'Raydium CLMM',
    programId: process.env.RAYDIUM_CLMM_PROGRAM_ID || 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
    category: 'clmm',
    enabled: true,
  },
  meteoraDlmm: {
    name: 'Meteora DLMM',
    programId: process.env.METEORA_DLMM_PROGRAM_ID || 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
    category: 'dlmm',
    enabled: true,
  },
  meteoraDynamicAmm: {
    name: 'Meteora Dynamic Pools',
    programId: process.env.METEORA_AMM_PROGRAM_ID || 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
    category: 'amm',
    enabled: true,
  },
};

/**
 * Returns list of all active program IDs for Helius LaserStream & WebSocket subscriptions.
 */
export function getActiveProgramIds(): string[] {
  return Object.values(PROTOCOL_PROGRAMS)
    .filter((p) => p.enabled)
    .map((p) => p.programId);
}

/**
 * Identifies the protocol for a given program ID.
 */
export function identifyProtocol(programId: string): ProtocolConfig | null {
  for (const protocol of Object.values(PROTOCOL_PROGRAMS)) {
    if (protocol.programId === programId) {
      return protocol;
    }
  }
  return null;
}
