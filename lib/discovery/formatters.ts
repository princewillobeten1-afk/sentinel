export function formatCompactUSD(val: number | string | undefined): string {
  if (val === undefined || val === null) return '$0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return '$0';
  if (num < 1) {
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
  }
  if (num < 1_000) {
    return `$${Math.round(num)}`;
  }
  if (num < 1_000_000) {
    const k = num / 1_000;
    return `$${k >= 100 ? Math.round(k) : k.toFixed(k < 10 ? 1 : 0)}K`;
  }
  const m = num / 1_000_000;
  return `$${m >= 100 ? Math.round(m) : m.toFixed(m < 10 ? 2 : 1)}M`;
}

export function formatSmartPrice(val: number | string | undefined): string {
  if (!val) return '$0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '$0.00';
  if (num >= 1_000) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(5)}`;
  // Tiny decimals with subscript zeros (e.g. $0.0₄421)
  const str = num.toFixed(9);
  const match = str.match(/^0\.(0+)(\d+)$/);
  if (match) {
    const zeroCount = match[1].length;
    const sigDigits = match[2].slice(0, 3);
    const subscriptDigits: Record<string, string> = {
      '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
    };
    const sub = subscriptDigits[String(zeroCount)] || `_${zeroCount}_`;
    return `$0.0${sub}${sigDigits}`;
  }
  return `$${num.toFixed(6)}`;
}

export function formatCount(num: number | undefined): string {
  if (!num) return '1';
  if (num < 1_000) return num.toString();
  if (num < 1_000_000) return `${(num / 1_000).toFixed(num < 10_000 ? 1 : 0)}K`;
  return `${(num / 1_000_000).toFixed(1)}M`;
}
