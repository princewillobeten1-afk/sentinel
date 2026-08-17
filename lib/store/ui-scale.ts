/**
 * Interface scale bounds and clamping.
 *
 * Kept in a plain module rather than inside `ui-store.tsx` so the pure logic is
 * directly unit-testable — a test importing the store's `.tsx` pulls JSX into a
 * node-environment test and fails to parse.
 *
 * Scale is a percentage applied to the root font size. Tailwind expresses both
 * type and spacing in `rem`, so scaling the root scales the whole interface
 * proportionally — padding, gaps and text together — rather than just enlarging
 * text and breaking every layout.
 */

export const UI_SCALE_MIN = 10;
export const UI_SCALE_MAX = 200;
export const UI_SCALE_DEFAULT = 100;

export const UI_SCALE_STORAGE_KEY = 'sentinel:ui-scale';

/** The browser default the percentage is applied against. */
export const ROOT_FONT_PX = 16;

/** Presets offered in settings. */
export const UI_SCALE_PRESETS = [50, 75, 100, 125, 150, 200] as const;

/** Below this, the UI is small enough to warrant warning the user. */
export const UI_SCALE_WARN_BELOW = 40;

/**
 * Constrains any input to a whole percentage within range.
 *
 * Deliberately total: `localStorage` can return a corrupted or non-numeric
 * value, and a `NaN` reaching the root font size would leave the interface at
 * an unusable size with no obvious way back. Anything not finite falls back to
 * the default rather than propagating.
 */
export function clampUiScale(value: number): number {
  if (!Number.isFinite(value)) return UI_SCALE_DEFAULT;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(value)));
}

/** The root font size, in px, for a given scale percentage. */
export function rootFontSizeFor(scale: number): number {
  return (ROOT_FONT_PX * clampUiScale(scale)) / 100;
}
