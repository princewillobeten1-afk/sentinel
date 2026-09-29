/**
 * Chart and canvas colours.
 *
 * Tailwind can't reach these. Charts, SVG strokes and canvas fills take literal
 * strings, so ~14 files had hardcoded hex values from the pre-refresh palette —
 * meaning the most visually prominent part of a trading product was the one
 * part the design system didn't govern. These constants close that gap: change
 * a colour here and every chart follows.
 *
 * Values mirror `tailwind.config.ts`. Keep them in step.
 */

/** Semantic — meaning, not decoration. Never use these as categorical series. */
export const chartSemantic = {
  /** Price/position moving in the holder's favour. */
  up: '#12B574',
  upSoft: '#22C489',
  /** Against. */
  down: '#EC5A5F',
  downSoft: '#EF7172',
  /** Needs attention but isn't a loss. */
  warning: '#E5A23D',
  /** Emphasis / selection. Deliberately not green or red. */
  accent: '#3B8FF0',
  accentSoft: '#6BA9F5',
  /** No movement. */
  flat: '#6E7A8A',
} as const;

/**
 * Categorical series. For charts where colour identifies *which* series, not
 * whether it's good or bad. All verified at ≥3:1 against the card surface
 * (#12171F), so no series disappears into the background.
 */
export const chartSeries = [
  '#3B8FF0', // azure
  '#2DD4BF', // teal
  '#A78BFA', // violet
  '#E5A23D', // amber
  '#F472B6', // magenta
  '#A3E635', // lime
] as const;

/** Deterministic series colour, so a token keeps its colour across renders. */
export function seriesColor(index: number): string {
  return chartSeries[index % chartSeries.length];
}

/** Chart chrome. Gridlines sit low-contrast so data reads above them. */
export const chartSurface = {
  ground: '#000000',
  card: '#141414',
  grid: 'rgba(255, 255, 255, 0.06)',
  gridStrong: 'rgba(255, 255, 255, 0.10)',
  axis: '#737373',
  label: '#A3A3A3',
  border: '#262626',
} as const;

/** Risk ramp — an ordered scale, so it steps rather than jumps hue randomly. */
export const riskScale = {
  low: '#12B574',
  moderate: '#3B8FF0',
  elevated: '#E5A23D',
  high: '#EF7172',
  critical: '#EC5A5F',
} as const;
