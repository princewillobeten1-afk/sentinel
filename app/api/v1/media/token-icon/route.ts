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

function detectImageContentType(body: Buffer, declaredType: string): string | null {
  if (declaredType.startsWith('image/')) return declaredType;
  if (body.length >= 4) {
    // PNG
    if (body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) {
      return 'image/png';
    }
    // JPEG
    if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
      return 'image/jpeg';
    }
    // GIF
    if (body[0] === 0x47 && body[1] === 0x49 && body[2] === 0x46) {
      return 'image/gif';
    }
    // WebP (RIFF....WEBP)
    if (
      body.length >= 12 &&
      body[0] === 0x52 &&
      body[1] === 0x49 &&
      body[2] === 0x46 &&
      body[3] === 0x46 &&
      body[8] === 0x57 &&
      body[9] === 0x45 &&
      body[10] === 0x42 &&
      body[11] === 0x50
    ) {
      return 'image/webp';
    }
    // SVG
    const head = body.slice(0, 200).toString('utf-8').toLowerCase();
    if (head.includes('<svg') || (head.includes('<?xml') && head.includes('<svg'))) {
      return 'image/svg+xml';
    }
  }
  return null;
}

function extractIpfsCid(urlStr: string): { cid: string; subpath: string } | null {
  try {
    const u = new URL(urlStr);
    const pathMatch = u.pathname.match(/\/ipfs\/([a-zA-Z0-9]+)(.*)/i);
    if (pathMatch) {
      return { cid: pathMatch[1], subpath: pathMatch[2] || '' };
    }
    const subMatch = u.hostname.match(/^([a-zA-Z0-9]+)\.ipfs\./i);
    if (subMatch) {
      return { cid: subMatch[1], subpath: u.pathname || '' };
    }
  } catch {
    // ignore
  }
  return null;
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
        headers: {
          host: url.hostname,
          accept: 'image/*,*/*;q=0.8',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'cache-control': 'no-cache',
        },
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

async function fetchWithRedirects(initialUrl: string): Promise<UpstreamImage | null> {
  let next = initialUrl;
  let upstream: UpstreamImage | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const verdict = await vetOutboundUrl(next);
    if (!verdict.ok) return null;

    const { url, address, family } = verdict.target;
    upstream = await fetchPinned(url, address, family);

    if (!upstream.redirected) break;
    if (!upstream.location || hop === MAX_REDIRECTS) return null;
    next = new URL(upstream.location, url).toString();
  }

  return upstream;
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('url');
  if (!requested) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const ipfsInfo = extractIpfsCid(requested);

    // Build URL attempt list: if it's a known-blocked IPFS gateway, prioritize fast gateways
    const urlAttempts: string[] = [];

    if (ipfsInfo) {
      const { cid, subpath } = ipfsInfo;
      const isKnownBlocked =
        requested.includes('ipfs.io') ||
        requested.includes('dweb.link') ||
        requested.includes('nftstorage.link') ||
        requested.includes('cf-ipfs.com') ||
        requested.includes('w3s.link');

      if (isKnownBlocked) {
        urlAttempts.push(`https://pump.mypinata.cloud/ipfs/${cid}${subpath}`);
        urlAttempts.push(`https://ipfs.filebase.io/ipfs/${cid}${subpath}`);
        urlAttempts.push(`https://gateway.pinata.cloud/ipfs/${cid}${subpath}`);
        urlAttempts.push(requested);
      } else {
        urlAttempts.push(requested);
        urlAttempts.push(`https://pump.mypinata.cloud/ipfs/${cid}${subpath}`);
        urlAttempts.push(`https://ipfs.filebase.io/ipfs/${cid}${subpath}`);
      }
    } else {
      urlAttempts.push(requested);
    }

    let upstream: UpstreamImage | null = null;
    let finalContentType: string | null = null;

    for (const candidateUrl of urlAttempts) {
      try {
        const res = await fetchWithRedirects(candidateUrl);
        if (res && res.status >= 200 && res.status < 300 && !res.tooLarge) {
          const type = detectImageContentType(res.body, res.contentType);
          if (type) {
            upstream = res;
            finalContentType = type;
            break;
          }
        }
      } catch {
        // try next candidate
      }
    }

    if (!upstream || !finalContentType) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'content-type': finalContentType,
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
