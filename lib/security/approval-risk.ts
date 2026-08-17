/**
 * Dangerous-approval detector (Sprint 30 — Tier 5).
 *
 * Pure and ready-to-integrate, but NOT yet called from any live
 * transaction-building code path — no such path exists yet, since
 * execution is still simulated (`lib/execution/engine.ts`). This exists so
 * the check is already correct and tested for whenever a real approval flow
 * is built, matching this sprint's "honest about the rest" framing rather
 * than hiding the gap.
 *
 * Deliberately uses plain `bigint`, not `lib/math/decimal.ts`'s `Decimal` —
 * `Decimal` parses human-readable decimal strings ("1.5") into its own
 * fixed 18-decimal scale; approval amounts here are raw atomic-unit
 * integers already scaled by a token's own `tokenDecimals` (9 for SOL, 6 for
 * USDC, etc., unrelated to Decimal's internal scale), so `bigint` is the
 * exact-comparison tool that actually matches the data's shape.
 */

export type ApprovalRiskLevel = 'SAFE' | 'ELEVATED' | 'DANGEROUS';

export interface ApprovalCheckInput {
  /** Raw atomic-unit string, e.g. an ERC-20 `approve()` amount or an SPL delegate amount. */
  requestedApprovalAmount: string;
  /** The wallet's current raw atomic-unit balance of the same token. */
  walletTokenBalance: string;
  tokenDecimals: number;
}

export interface ApprovalCheckResult {
  level: ApprovalRiskLevel;
  /** Requested amount ÷ balance. `null` when balance is zero or the amount is flagged unlimited (a ratio isn't meaningful in either case). */
  ratioToBalance: number | null;
  isUnlimited: boolean;
  reasoning: string;
}

/** The canonical "infinite approval" sentinel — max uint256, the value wallets like MetaMask default to. */
const EVM_MAX_UINT256 = (2n ** 256n) - 1n;
/** Requests at or above half of max-uint256 are functionally unlimited even if not the exact sentinel. */
const UNLIMITED_THRESHOLD = EVM_MAX_UINT256 / 2n;

const ELEVATED_RATIO_THRESHOLD = 10;
const DANGEROUS_RATIO_THRESHOLD = 100;

export function evaluateApprovalRisk(input: ApprovalCheckInput): ApprovalCheckResult {
  const requested = BigInt(input.requestedApprovalAmount);
  const balance = BigInt(input.walletTokenBalance);

  if (requested >= UNLIMITED_THRESHOLD) {
    return {
      level: 'DANGEROUS',
      ratioToBalance: null,
      isUnlimited: true,
      reasoning: 'This approval requests an effectively unlimited amount — the contract could spend your entire balance at any time in the future, not just this transaction.',
    };
  }

  if (balance === 0n) {
    // No balance to compare against — can't compute a ratio, but a nonzero
    // request against a zero balance isn't itself dangerous (nothing to lose yet).
    return {
      level: requested > 0n ? 'ELEVATED' : 'SAFE',
      ratioToBalance: null,
      isUnlimited: false,
      reasoning: requested > 0n
        ? 'Requested approval amount could not be compared against a wallet balance (balance is zero).'
        : 'No approval requested.',
    };
  }

  // Scale up before dividing so the ratio keeps meaningful precision as a plain JS number.
  const RATIO_PRECISION = 1_000_000n;
  const ratioToBalance = Number((requested * RATIO_PRECISION) / balance) / Number(RATIO_PRECISION);

  if (ratioToBalance >= DANGEROUS_RATIO_THRESHOLD) {
    return {
      level: 'DANGEROUS',
      ratioToBalance,
      isUnlimited: false,
      reasoning: `Requested approval of ${formatAtomicAmount(requested, input.tokenDecimals)} is ${ratioToBalance.toFixed(0)}x your current balance of ${formatAtomicAmount(balance, input.tokenDecimals)} — far beyond what this transaction could plausibly need.`,
    };
  }

  if (ratioToBalance >= ELEVATED_RATIO_THRESHOLD) {
    return {
      level: 'ELEVATED',
      ratioToBalance,
      isUnlimited: false,
      reasoning: `Requested approval of ${formatAtomicAmount(requested, input.tokenDecimals)} is ${ratioToBalance.toFixed(1)}x your current balance of ${formatAtomicAmount(balance, input.tokenDecimals)} — more than this transaction likely needs.`,
    };
  }

  return {
    level: 'SAFE',
    ratioToBalance,
    isUnlimited: false,
    reasoning: 'Requested approval amount is proportionate to the wallet balance.',
  };
}

/** Formats a raw atomic-unit amount as a human-readable decimal string for display in `reasoning`. */
function formatAtomicAmount(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const str = abs.toString().padStart(decimals + 1, '0');
  const integerPart = str.slice(0, str.length - decimals) || '0';
  const fractionalPart = str.slice(str.length - decimals).replace(/0+$/, '');
  const withSign = negative ? '-' : '';
  return fractionalPart ? `${withSign}${integerPart}.${fractionalPart}` : `${withSign}${integerPart}`;
}
