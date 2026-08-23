import { redirect } from 'next/navigation';

/**
 * Bare `/trade` has no token, so redirect to one.
 *
 * This previously re-exported the dynamic `[chain]/[token]` page directly.
 * `useParams()` is empty on this route, so that page fell through to its
 * fallback mint `'7xK99zK8mP2xQ5wN3a19'` — a 20-character string that
 * `lib/wallet/__tests__/validation.test.ts:17` explicitly asserts is *not* a
 * valid Solana address. Every downstream lookup was therefore doomed before it
 * started, which is what produced the permanent `Loading...` header and the
 * all-zero metric tiles.
 *
 * Redirecting means the page always receives a real mint through the normal
 * route params, and the URL reflects what is actually being traded.
 */

/** Wrapped SOL — the canonical default market. */
const DEFAULT_MINT = 'So11111111111111111111111111111111111111112';

export default function TradePage() {
  redirect(`/trade/solana/${DEFAULT_MINT}`);
}
