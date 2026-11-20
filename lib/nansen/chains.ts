export const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112';
export const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const EVM_NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const EVM_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Maps Sentinel/route chain names to canonical Nansen API v1 chain IDs.
 * Note: BNB Smart Chain is `'bnb'` (not `'bsc'`); Robinhood Chain is `'robinhood'`.
 */
export function toNansenChain(chain?: string | null): string {
  const normalized = (chain ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'solana' || normalized === 'sol') return 'solana';
  if (
    normalized === 'robinhood' ||
    normalized === 'robinhood-testnet' ||
    normalized === 'robinhood_testnet' ||
    normalized === '4663' ||
    normalized === '46630'
  ) {
    return 'robinhood';
  }
  if (normalized === 'bsc' || normalized === 'bnb' || normalized === '56') return 'bnb';
  if (normalized === 'eth' || normalized === 'ethereum' || normalized === '1') return 'ethereum';
  if (normalized === 'arb' || normalized === 'arbitrum' || normalized === '42161') return 'arbitrum';
  if (normalized === 'base' || normalized === '8453') return 'base';
  if (normalized === 'polygon' || normalized === 'matic' || normalized === '137') return 'polygon';
  if (normalized === 'avax' || normalized === 'avalanche') return 'avalanche';
  if (normalized === 'all') return 'all';
  return normalized;
}

export function isNansenNativeToken(chain: string, address: string): boolean {
  const clean = address.trim();
  if (!clean) return false;
  const nansenChain = toNansenChain(chain);
  if (nansenChain === 'solana') {
    return clean === SOLANA_NATIVE_MINT;
  }
  const lower = clean.toLowerCase();
  return lower === EVM_NATIVE_PLACEHOLDER || lower === EVM_ZERO_ADDRESS;
}

/**
 * `/api/v1/tgm/dex-trades` rejects native SOL (`So111...112`) and
 * Solana USDC (`EPjFW...TDt1v`) with HTTP 422.
 */
export function isNansenTgmDexTradesRestricted(chain: string, address: string): boolean {
  const clean = address.trim();
  if (!clean) return true;
  if (isNansenNativeToken(chain, clean)) return true;
  return toNansenChain(chain) === 'solana' && clean === SOLANA_USDC_MINT;
}
