/**
 * API Key Permission Scopes (Sprint 28 §8, §10, §95, §96)
 *
 * Closed enum, deliberately small and explicit. A scope is only ever granted
 * because the key creator checked a box for it — nothing here is implied or
 * bundled automatically, and the "dangerous" scopes (trading, launch
 * deployment) get an extra guard so a read-only integration can never end up
 * with write power by accident.
 */

export const SCOPES = [
  'READ_MARKET_DATA',
  'READ_TOKEN_INTELLIGENCE',
  'READ_WALLET_DATA',
  'READ_REPUTATION',
  'READ_PORTFOLIO',
  'READ_ALERTS',

  'TRADE',
  'CREATE_ORDER',
  'CANCEL_ORDER',

  'CREATE_LAUNCH',
  'MANAGE_LAUNCH',

  'MANAGE_WEBHOOKS',
] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

/**
 * Scopes that grant write/financial power. Never included in a "default"
 * permission set anywhere in this codebase — a caller must explicitly
 * request each one, and the dashboard's key-creation UI must never
 * pre-check these boxes (spec §8: "Never give trading permission
 * automatically").
 */
export const DANGEROUS_SCOPES: ReadonlySet<Scope> = new Set(['TRADE', 'CREATE_ORDER', 'CANCEL_ORDER', 'MANAGE_LAUNCH']);

export const READ_ONLY_SCOPES: readonly Scope[] = SCOPES.filter((scope) => !DANGEROUS_SCOPES.has(scope));

export class ScopeGrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeGrantError';
  }
}

/**
 * Validates a requested scope set before a key is created or rotated.
 * Throws rather than silently dropping/adding scopes, so a misconfigured
 * request fails loudly instead of producing a key with unexpected power (or
 * unexpectedly little power).
 *
 * Rule from spec §96: deploying a launch is strictly more dangerous than
 * creating one, so MANAGE_LAUNCH requires CREATE_LAUNCH to be requested
 * alongside it — a key that can deploy but was never granted the ability to
 * create in the first place is a shape that shouldn't exist.
 */
export function assertScopeGrantable(requested: Scope[]): void {
  const unique = new Set(requested);

  for (const scope of unique) {
    if (!isScope(scope)) {
      throw new ScopeGrantError(`Unknown scope: ${scope}`);
    }
  }

  if (unique.has('MANAGE_LAUNCH') && !unique.has('CREATE_LAUNCH')) {
    throw new ScopeGrantError('MANAGE_LAUNCH requires CREATE_LAUNCH to also be requested.');
  }
}

/** True when `granted` covers every scope in `required` (empty `required` always passes). */
export function hasRequiredScopes(granted: Scope[], required: Scope[]): boolean {
  if (required.length === 0) return true;
  const grantedSet = new Set(granted);
  return required.every((scope) => grantedSet.has(scope));
}

export function missingScopes(granted: Scope[], required: Scope[]): Scope[] {
  const grantedSet = new Set(granted);
  return required.filter((scope) => !grantedSet.has(scope));
}
