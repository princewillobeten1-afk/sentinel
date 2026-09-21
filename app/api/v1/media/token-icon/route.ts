import { NextResponse } from 'next/server';
import { request as httpsRequest } from 'node:https';
import { vetOutboundUrl } from '@/lib/server/ssrf-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/media/token-icon?url=<https image url>
 *
 * Proxies token art.
 *
 * Token metadata points at IPFS gateways, Arweave, launchpad CDNs and, often,
 * a domain the creator owns. Loading those directly from the browser means a
 * page-wide CSP that permits arbitrary remote images, and it exposes every
 * viewer's IP to whatever host a stranger put in a token's metadata. Proxying
 * sidesteps both, and lets responses be cached.
 *
 * ## Not an open proxy
 *
 * A route that fetches any caller-supplied URL is a server-side request forgery
 * primitive. The defences:
 *
 *  - **https only**, and no literal IP addresses.
 *  - the hostname is resolved and **every** address it answers with must be
 *    publicly routable (`lib/server/ssrf-guard.ts`).
 *  - the connection is made **to the vetted address**, with SNI and `Host` set
 *    for the original name — re-resolving after the check would allow a DNS
 *    entry to answer public once and internal a moment later.
 *  - **redirects are refused**, since a redirect is an unvetted second hop.
 *  - the response must declare an **image** content type.
 *  - the body is **size-capped mid-stream**, so a hostile host cannot stream
 *    indefinitely — the socket is destroyed as soon as the cap is passed.
 *
 * ## Why not a host allowlist
 *
 * It used to be one, of fourteen gateways. Measured across 330 live tokens it
 * refused **52% of all icons** — Irys, j7tracker, backed.fi, Filebase and a
 * long tail of per-token CDN subdomains — which is why so many cards rendered a
 * blank avatar. The property that makes a URL dangerous is the address it
 * resolves to, not whether someone remembered to list its name.
 */

/**
 * 8 MiB.
 *
 * The old 2 MiB cap refused 2 of every 30 live icons. The response is cached
 * for a day, so the cost is paid once per token, and the cap exists to stop an
 * endless stream rather than to enforce a size budget.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Redirects are followed, but every hop is vetted again.
 *
 * IPFS gateways redirect as a matter of course — `gateway.irys.xyz` sends a
 * 301 to its CDN — so refusing outright loses legitimate art. Following blindly
 * is the SSRF hole the vetting exists to close: an allowed host could redirect
 * straight to `169.254.169.254`. So each hop goes back through
 * `vetOutboundUrl` and connects to its own vetted address, and the chain is
 * bounded so a redirect loop cannot spin.
 */
const MAX_REDIRECTS = 3;

interface UpstreamImage {
  status: number;
  contentType: string;
  body: Buffer;
  tooLarge: boolean;
  redirected: boolean;
  /** Set when `redirected` — the raw Location header, not yet vetted. */
  location?: string;
}

/** Fetches over a connection pinned to `address`. */
function fetchPinned(
  url: URL,
  address: string,
  family: 4 | 6,
): Promise<UpstreamImage> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: address,
        family,
        // TLS is still validated against the real hostname, so a pinned
        // connection cannot be silently redirected to some other server.
        servername: url.hostname,
        port: url.port ? Number(url.port) : 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { host: url.hostname, accept: 'image/*' },
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 502;
        const redirected = status >= 300 && status < 400;
        if (redirected) {
          res.destroy();
          resolve({
            status,
            contentType: '',
            body: Buffer.alloc(0),
            tooLarge: false,
            redirected,
            location: res.headers.location,
          });
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        let tooLarge = false;

        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            // Stop paying for bytes we have already decided to refuse.
            tooLarge = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          resolve({
            status,
            contentType: res.headers['content-type'] ?? '',
            body: Buffer.concat(chunks),
            tooLarge,
            redirected: false,
          }),
        );
        res.on('error', reject);
        res.on('close', () => {
          if (tooLarge) {
            resolve({
              status,
              contentType: res.headers['content-type'] ?? '',
              body: Buffer.alloc(0),
              tooLarge: true,
              redirected: false,
            });
          }
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('url');
  if (!requested) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    let next = requested;
    let upstream: UpstreamImage | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // Every hop is vetted, including the ones an upstream chose for us.
      const verdict = await vetOutboundUrl(next);
      if (!verdict.ok) {
        return NextResponse.json({ error: verdict.reason }, { status: 400 });
      }

      const { url, address, family } = verdict.target;
      upstream = await fetchPinned(url, address, family);

      if (!upstream.redirected) break;
      if (!upstream.location) {
        return NextResponse.json({ error: 'Redirect without a location' }, { status: 502 });
      }
      if (hop === MAX_REDIRECTS) {
        return NextResponse.json({ error: 'Too many redirects' }, { status: 502 });
      }
      // Relative Locations are normal; resolve against the hop we just made.
      next = new URL(upstream.location, url).toString();
    }

    if (!upstream) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }
    if (upstream.status < 200 || upstream.status >= 300) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
    }
    if (upstream.tooLarge) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }
    if (!upstream.contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 415 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'content-type': upstream.contentType,
        // Token art is immutable in practice; a long cache keeps a scrolling
        // column from re-fetching the same icons every poll.
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
        'cross-origin-resource-policy': 'same-origin',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 504 });
  }
}
