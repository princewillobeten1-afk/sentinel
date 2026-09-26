/**
 * Display formatters for the discovery feed.
 *
 * Consolidates two near-identical copies that had drifted apart in
 * `components/discovery/token-card.tsx` and `token-discovery-card.tsx`.
 *
 * These exist because a dense feed has a hard width budget: a card row is a few
 * dozen pixels wide, and `$1,234,567.89` does not fit next to five other
 * metrics. Every function here trades exactness for scannability *in display
 * only* — never feed these values back into arithmetic.
 */

/** Superscript-style digits used to compress long runs of leading zeros. */
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function toSubscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d)
    .join('');
}

function toNumber(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * Abbreviates a USD magnitude to at most ~5 characters: `1.2K`, `48.3M`, `2.1B`.
 *
 * Significant digits shrink as magnitude grows so the string width stays
 * roughly constant — the property that lets a column of these stay aligned.
 */
export function formatCompactUsd(value: number | string | undefined | null): string {
  const num = toNumber(value);
  if (num === null) return '—';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs === 0) return '0';
  if (abs < 1) return `${sign}${abs.toFixed(abs < 0.01 ? 4 : 2)}`;
  if (abs < 1_000) return `${sign}${abs < 10 ? abs.toFixed(1) : Math.round(abs)}`;

  const units: Array<[number, string]> = [
    [1_000_000_000_000, 'T'],
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [1_000, 'K'],
  ];

  for (const [divisor, suffix] of units) {
    if (abs >= divisor) {
      const scaled = abs / divisor;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${sign}${scaled.toFixed(digits)}${suffix}`;
    }
  }
  return `${sign}${Math.round(abs)}`;
}

/**
 * Formats a token price, compressing leading zeros the way trading terminals do.
 *
 * A freshly-launched token often prices around 0.0000000123. Rendered plainly
 * that is 12 characters of mostly zeros, and two such prices are impossible to
 * tell apart at a glance. `0.0₇123` puts the zero *count* in one glyph and
 * gives the significant digits the space, so the magnitude is what the eye
 * catches first.
 */
export function formatTokenPrice(value: number | string | undefined | null): string {
  const num = toNumber(value);
  if (num === null) return '—';
  if (num === 0) return '0';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  // Grouped above a thousand — an ungrouped "1245.50" is misread as often as not.
  if (abs >= 1_000) {
    return `${sign}${abs.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (abs >= 1) return `${sign}${abs.toFixed(2)}`;
  if (abs >= 0.01) return `${sign}${abs.toFixed(4)}`;
  if (abs >= 0.0001) return `${sign}${abs.toFixed(5)}`;

  // Count leading zeros after the decimal point, then three significant digits.
  // Truncated rather than rounded: rounding 0.00002845 up to …285 would state a
  // price the token never had, and at this magnitude the third digit is noise.
  const exponent = Math.floor(Math.log10(abs));
  const leadingZeros = Math.abs(exponent) - 1;
  const significant = Math.floor(abs * Math.pow(10, Math.abs(exponent) + 2));

  return `${sign}0.0${toSubscript(leadingZeros)}${significant}`;
}

/**
 * Formats a floor / token price in SOL with subscript zeros (Axiom / Photon style: `0.0₂1`, `0.093`, `2.359`).
 */
export function formatSolFloorPrice(
  priceInSol: number | string | undefined | null,
): string {
  const num = toNumber(priceInSol);
  if (num === null) return '—';
  if (num === 0) return '0';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1) return `${sign}${abs.toFixed(abs >= 10 ? 2 : 3)}`;
  if (abs >= 0.01) return `${sign}${abs.toFixed(3)}`;

  const exponent = Math.floor(Math.log10(abs));
  const leadingZeros = Math.abs(exponent) - 1;
  const significant = Math.floor(abs * Math.pow(10, Math.abs(exponent)));

  if (leadingZeros <= 1) {
    return `${sign}${abs.toFixed(3)}`;
  }
  return `${sign}0.0${toSubscript(leadingZeros)}${significant}`;
}

/** Signed percentage with a fixed one-decimal width: `+12.4%`, `-3.0%`. */
export function formatPercent(value: number | undefined | null, digits = 1): string {
  const num = toNumber(value);
  if (num === null) return '—';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(digits)}%`;
}

/**
 * Whole counts, abbreviated past a thousand: `847`, `1.8K`, `42K`, `689K`.
 *
 * Coarser than {@link formatCompactUsd} — a holder count of 42,137 is `42K`,
 * because the hundreds digit changes constantly and carries no meaning to
 * someone scanning a column.
 *
 * Zero is `0`. The copy this replaced returned `'1'` for both zero and missing
 * (`if (!num) return '1'`), so a token with no holder data displayed one holder.
 */
export function formatCount(value: number | undefined | null): string {
  const num = toNumber(value);
  if (num === null) return '—';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs < 1_000) return `${sign}${Math.round(abs)}`;
  if (abs < 1_000_000) return `${sign}${(abs / 1_000).toFixed(abs < 10_000 ? 1 : 0)}K`;
  return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
}

/**
 * Compresses an age in minutes to one or two characters plus a unit.
 *
 * Age is the single most-scanned field in a new-pairs feed, so it is kept to
 * the narrowest form that stays unambiguous: `42s`, `7m`, `3h`, `2d`.
 */
export function formatAge(minutes: number | undefined | null): string {
  const num = toNumber(minutes);
  if (num === null || num < 0) return '—';
  if (num < 1) return `${Math.max(1, Math.round(num * 60))}s`;
  if (num < 60) return `${Math.floor(num)}m`;
  if (num < 1_440) return `${Math.floor(num / 60)}h`;
  return `${Math.floor(num / 1_440)}d`;
}

/** Truncates a mint address to `AbCd…WxYz` for display next to a copy button. */
export function shortenAddress(address: string | undefined | null, lead = 4, tail = 4): string {
  if (!address) return '—';
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Buy share of total trades, 0–100.
 *
 * Returns null rather than 50 when there are no trades: an untraded token has
 * no pressure reading, and defaulting to "balanced" would draw a half-filled
 * bar that looks like real two-sided activity.
 */
export function buyPressurePct(buys: number | undefined, sells: number | undefined): number | null {
  const b = toNumber(buys) ?? 0;
  const s = toNumber(sells) ?? 0;
  const total = b + s;
  if (total <= 0) return null;
  return (b / total) * 100;
}

/**
 * Formats live-ticking relative time since pair creation:
 * - <60s: `7s`, `47s`
 * - <60m: `1m`, `12m`
 * - <24h: `1h`, `5h`
 * - >=24h: `1d`, `3d`
 */
export function formatLiveAge(ageMinutes: number, elapsedSec = 0): string {
  const totalSec = Math.max(1, Math.round(ageMinutes * 60 + elapsedSec));
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Formats a boost countdown timer:
 * - < 3600s: `m:ss` (e.g. `4:32`, `0:45`)
 * - >= 3600s: `${h}h ${m}m` (e.g. `14h 25m`)
 * - <= 0s: null
 */
export function formatBoostCountdown(remainingSec: number | undefined | null): string | null {
  if (remainingSec === undefined || remainingSec === null || remainingSec <= 0) return null;
  const sec = Math.floor(remainingSec);
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Keep provider provenance readable without exposing raw internal route slugs.
 */
export function formatDisplaySource(source?: string | null): string {
  if (!source) return 'On-chain';
  const label = (part: string): string => {
    const s = part.toLowerCase().trim();
    if (s.includes('birdeye') && s.includes('holder')) return 'Birdeye holders';
    if (s.includes('birdeye')) return 'Birdeye';
    if (s.includes('rugcheck')) return 'Rugcheck';
    if (s.includes('bitquery')) return 'Bitquery';
    if (s.includes('quicknode')) return 'QuickNode';
    if (s.includes('helius')) return 'Helius';
    if (s.includes('solana-rpc') || s === 'rpc-supply') return 'Solana RPC';
    if (s.includes('pump')) return 'Pump.fun';
    if (s.includes('raydium')) return 'Raydium';
    if (s.includes('meteora')) return 'Meteora';
    if (s.includes('jupiter')) return 'Jupiter';
    if (s === 'fixture' || s === 'mock' || s === 'test') return 'On-chain';
    if (s.includes('-') || s.includes('_')) return 'On-chain analysis';
    return part;
  };
  return [...new Set(source.split('+').map(label))].join(' + ');
}
