/**
 * Canonical endpoint registry.
 *
 * One place that answers "which endpoint serves this feature". Before this
 * existed, ~70 fetch call sites each hardcoded their own URL string, and the
 * result was three separate failure modes found in the routing audit:
 *
 *  1. Features pointed at endpoints that do not exist at all
 *     (`/api/launches/:id/risk` — there is no `app/api/launches` directory,
 *     so every call 404'd and the view sat on its loading state forever).
 *  2. Features pointed at unversioned mock routes that shadowed the real,
 *     Postgres-backed `/api/v1/*` ones built in Phases 1–5 — e.g. `/api/alerts`
 *     returned one hardcoded alert to every caller with no auth, while
 *     `/api/v1/alerts` served that user's real rows.
 *  3. The same resource spelled differently in different files, so a route
 *     rename could only ever be found by grep.
 *
 * Rules for this file:
 *  - Every path here must correspond to a real route under `app/api/`.
 *  - Paths are relative to `/api` — `apiClient` in `./client.ts` adds the
 *    prefix. Never write `/api/...` at a call site.
 *  - Anything user-scoped is authenticated by the `sentinel_session` cookie
 *    (HttpOnly, SameSite=Lax). `fetch` sends it automatically on same-origin
 *    requests, so no call site needs to attach a token by hand.
 */

/** Path segments are encoded — a token address or symbol can contain `/` or `#`. */
const seg = (value: string) => encodeURIComponent(value);

/**
 * Turns a registry path into a URL `fetch` can take, optionally with a query.
 *
 * Call sites that use `apiClient` do not need this — the client adds the prefix
 * itself. It exists for plain `fetch` call sites so the `/api` prefix is still
 * written in exactly one place.
 *
 * Undefined and null query values are dropped rather than serialised as the
 * strings "undefined"/"null", which is what template-literal URLs did.
 */
export function apiUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>): string {
  const base = `/api${path}`;
  if (!query) return base;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export const endpoints = {
  auth: {
    me: '/v1/auth/me',
    login: '/v1/auth/login',
    register: '/v1/auth/register',
    logout: '/v1/auth/logout',
    logoutAll: '/v1/auth/logout-all',
    sessions: '/v1/auth/sessions',
    session: (id: string) => `/v1/auth/sessions/${seg(id)}`,
    forgotPassword: '/v1/auth/forgot-password',
    resetPassword: '/v1/auth/reset-password',
    changePassword: '/v1/auth/change-password',
    verifyEmail: '/v1/auth/verify-email',
  },

  wallets: {
    /** Registry of the caller's linked wallets (Postgres, Phase 1). */
    list: '/v1/wallets',
    byId: (id: string) => `/v1/wallets/${seg(id)}`,
    setDefault: (id: string) => `/v1/wallets/${seg(id)}/default`,
    connectRequest: '/v1/wallets/connect/request',
    connectVerify: '/v1/wallets/connect/verify',
    balance: (id: string) => `/v1/user/wallets/${seg(id)}/balance`,
    transactions: '/v1/user/wallets/transactions',
    /** Pre-trade safety simulation. Callers holding a quote should pass it in instead. */
    simulate: '/wallets/simulate',
  },

  portfolio: {
    /** Portfolio is wallet-scoped and ownership-checked; there is no "current wallet" default. */
    overview: (wallet: string) => `/v1/portfolio/${seg(wallet)}`,
    positions: (wallet: string) => `/v1/portfolio/${seg(wallet)}/positions`,
    risk: (wallet: string) => `/v1/portfolio/${seg(wallet)}/risk`,
    performance: (wallet: string) => `/v1/portfolio/${seg(wallet)}/performance`,
  },

  orders: {
    /** Postgres-backed order domain with an enforced state machine (Phase 3). */
    list: '/v1/orders',
    create: '/v1/orders',
    byId: (id: string) => `/v1/orders/${seg(id)}`,
    open: '/v1/orders/open',
  },

  trading: {
    /** Validated, rate-limited swap pricing through the quote router. */
    quote: '/v1/trading/quote',
    prepare: '/v1/trading/prepare',
    submit: '/v1/trading/submit',
    history: '/v1/trading/history',
  },

  alerts: {
    /** Fired-alert feed. Rule configuration is a different resource — see `alertRules`. */
    events: '/v1/alerts',
    event: (id: string) => `/v1/alerts/${seg(id)}`,
    rules: '/v1/alert-rules',
    rule: (id: string) => `/v1/alert-rules/${seg(id)}`,
  },

  tokens: {
    /** Registry of record: what tokens exist. Distinct from ranked `search`. */
    registry: '/v1/tokens',
    search: '/v1/tokens/search',
    trending: '/v1/tokens/trending',
    byChainAddress: (chain: string, address: string) => `/v1/tokens/${seg(chain)}/${seg(address)}`,
    holders: (chain: string, address: string) => `/v1/tokens/${seg(chain)}/${seg(address)}/holders`,
    trades: (chain: string, address: string) => `/v1/tokens/${seg(chain)}/${seg(address)}/trades`,
    liquidity: (chain: string, address: string) => `/v1/tokens/${seg(chain)}/${seg(address)}/liquidity`,
    topTraders: (chain: string, address: string) => `/v1/tokens/${seg(chain)}/${seg(address)}/top-traders`,
    bubbleMap: (chain: string, address: string) => `/v1/tokens/${seg(chain)}/${seg(address)}/bubble-map`,
    devActivity: (chain: string, address: string) => `/v1/tokens/${seg(chain)}/${seg(address)}/dev-activity`,
  },

  intelligence: {
    token: (chain: string, token: string) => `/v1/intelligence/${seg(chain)}/${seg(token)}`,
    insiders: (chain: string, token: string) => `/v1/intelligence/${seg(chain)}/${seg(token)}/insiders`,
    liquidity: (chain: string, token: string) => `/v1/intelligence/${seg(chain)}/${seg(token)}/liquidity`,
    exitability: (chain: string, token: string) => `/v1/exitability/${seg(chain)}/${seg(token)}`,
    ownershipClusters: (chain: string, token: string) => `/v1/ownership/${seg(chain)}/${seg(token)}/clusters`,
  },

  launches: {
    list: '/v1/launches',
    byId: (id: string) => `/v1/launches/${seg(id)}`,
    intelligence: (id: string) => `/v1/launches/${seg(id)}/intelligence`,
    simulate: (id: string) => `/v1/launches/${seg(id)}/simulate`,
  },

  developer: {
    apiKeys: '/v1/user/api-keys',
    apiKey: (id: string) => `/v1/user/api-keys/${seg(id)}`,
    rotateApiKey: (id: string) => `/v1/user/api-keys/${seg(id)}/rotate`,
    usage: '/v1/user/usage',
    webhooks: '/v1/webhooks',
    webhook: (id: string) => `/v1/webhooks/${seg(id)}`,
    testWebhook: (id: string) => `/v1/webhooks/${seg(id)}/test`,
  },
} as const;
