/**
 * Strips invisible Unicode from token names and symbols.
 *
 * ## Why this is a security fix
 *
 * A token appeared in the live feed rendering as `‮RSU` — the name carries
 * U+202E RIGHT-TO-LEFT OVERRIDE, so the browser reverses everything after it
 * and `evreseR setatS detinU` displays as "United States Reserve". The chain
 * stores one string; the user reads another. That is the whole technique: a
 * scam token wearing a legitimate name, with nothing visibly wrong.
 *
 * The controls that matter:
 *
 *  - **U+202A–U+202E** — the bidi embedding/override set. U+202E is the one
 *    used for spoofing; the rest can reorder text just as effectively.
 *  - **U+2066–U+2069** — the newer isolates, same capability.
 *  - **U+200B–U+200F** — zero-width space/joiner and the LTR/RTL marks. These
 *    make two different strings look identical, so `USDC` and `US​DC`
 *    render the same while being different tokens.
 *  - **U+FEFF** — zero-width no-break space, the same trick again.
 *
 * ## Why strip rather than escape
 *
 * These characters have no legitimate purpose in a ticker. Escaping them would
 * put `‮` on the card, which is noise; rendering them raw is the exploit.
 * Removing them shows the name the chain actually stores, in the order it is
 * stored.
 *
 * ## Why the flag matters as much as the strip
 *
 * A token that tried this is telling you something about itself. Silently
 * cleaning it would hide a real signal, so `sanitizeTokenName` reports whether
 * anything was removed and the caller marks the row.
 */

/** Bidi controls, directional marks, zero-width characters, and the BOM. */
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

export interface SanitizedName {
  /** Safe to render. */
  value: string;
  /** True when at least one invisible character was removed. */
  suspicious: boolean;
}

/**
 * Removes invisible control characters, reporting whether any were present.
 *
 * Trailing and leading whitespace is trimmed afterwards, because stripping a
 * control can leave a stray space that would otherwise shift the layout.
 */
export function sanitizeTokenName(raw: string | undefined | null): SanitizedName {
  if (!raw) return { value: '', suspicious: false };

  const cleaned = raw.replace(INVISIBLE, '');
  if (cleaned === raw) return { value: raw, suspicious: false };

  return { value: cleaned.trim(), suspicious: true };
}

/** True when the string carries any character this module would remove. */
export function hasInvisibleCharacters(raw: string | undefined | null): boolean {
  if (!raw) return false;
  INVISIBLE.lastIndex = 0;
  return INVISIBLE.test(raw);
}
