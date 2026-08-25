import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/media/token-icon?url=<encoded>
 *
 * Serves a token logo through this origin.
 *
 * Token metadata points at IPFS and Arweave gateways, and the browser refuses
 * those images with `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` — the gateways send
 * a restrictive `Cross-Origin-Resource-Policy`, so every Discover card fell
 * back to a lettermark. Fetching server-side and re-serving from our own origin
 * sidesteps that, and has two side benefits: viewers' IP addresses are never
 * exposed to third-party gateways, and responses can be cached.
 *
 * ## This is deliberately not an open proxy
 *
 * A route that fetches any URL a caller supplies is a server-side request
 * forgery primitive: it would happily fetch `http://169.254.169.254/` (cloud
 * metadata) or an internal address and hand back the contents. So:
 *
 *  - **https only**, and the host must be on `ALLOWED_HOSTS`.
 *  - **redirects are not followed** — an allowed host could otherwise redirect
 *    to an internal address and defeat the allowlist.
 *  - the response must declare an **image** content type.
 *  - the body is **size-capped**, so a hostile host cannot stream indefinitely.
 */

/** Gateways that token metadata legitimately points at. */
const ALLOWED_HOSTS = new Set([
  'ipfs.io',
  'cloudflare-ipfs.com',
  'gateway.pinata.cloud',
  'pump.mypinata.cloud',
  'arweave.net',
  'www.arweave.net',
  'cdn.dexscreener.com',
  'dd.dexscreener.com',
  'image-cdn.solana.fm',
  'shdw-drive.genesysgo.net',
  'static.jup.ag',
  'raw.githubusercontent.com',
  'nftstorage.link',
  'metadata.jito.network',
]);

const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('url');
  if (!requested) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(requested);
  } catch {
    return NextResponse.json({ error: 'Malformed url' }, { status: 400 });
  }

  if (target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only https sources are proxied' }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: `Host not allowed: ${target.hostname}` }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      // A redirect could point somewhere the allowlist would have refused.
      redirect: 'error',
      headers: { accept: 'image/*' },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 415 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'content-type': contentType,
        // Token art is immutable in practice; a long cache keeps a scrolling
        // column from re-fetching the same icons every poll.
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
        'cross-origin-resource-policy': 'same-origin',
      },
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return NextResponse.json(
      { error: aborted ? 'Upstream timed out' : 'Failed to fetch image' },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }
}
