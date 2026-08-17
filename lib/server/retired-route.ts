/**
 * Marks an unversioned route as retired in favour of its `/api/v1` replacement.
 *
 * The routing audit found a set of unversioned endpoints that shadowed the real,
 * Postgres-backed v1 routes: `/api/alerts` returned one hardcoded alert to any
 * caller with no authentication, `/api/dashboard/overview` returned four fixed
 * strings, `/api/wallets` served an in-memory demo engine's wallets, and
 * `/api/orders` wrote to a module-scope array. Every one of them was reachable
 * by anyone and returned plausible-looking data that belonged to nobody.
 *
 * They are answered with 410 Gone rather than deleted outright so that anything
 * still pointing at them fails loudly and says where to go, instead of getting a
 * 404 that reads like a bug in the caller. `Deprecation` and `Link` follow
 * RFC 8594 / RFC 8288 so the replacement is machine-readable too.
 */

export function retiredRoute(replacement: string, note?: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'ENDPOINT_RETIRED',
        message: `This endpoint has been retired. Use ${replacement} instead.`,
        replacement,
        ...(note ? { note } : {}),
      },
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        Deprecation: 'true',
        Link: `<${replacement}>; rel="successor-version"`,
        // Never let an intermediary cache a retirement notice as if it were data.
        'Cache-Control': 'no-store',
      },
    },
  );
}
