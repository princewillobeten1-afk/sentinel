import { lookup } from 'node:dns/promises';

/**
 * Decides whether the server may fetch a caller-supplied URL.
 *
 * ## Why not a host allowlist
 *
 * The icon proxy used to carry a hand-written list of fourteen gateways. Token
 * metadata points wherever its creator chose, so the list was permanently
 * behind reality: measured across 330 live tokens, **52% of all icons were
 * refused** — `gateway.irys.xyz` (19), `metadata.j7tracker.io` (18),
 * `xstocks-metadata.backed.fi` (15), plus a long tail of per-token CDN
 * subdomains and one-off domains that no list could ever enumerate.
 *
 * The thing an allowlist was protecting against is server-side request forgery:
 * a proxy that fetches any URL will happily read `http://169.254.169.254/`
 * (cloud instance metadata) or an address inside the private network and hand
 * the response back. But the property that makes a URL dangerous is **the
 * address it resolves to**, not its name — so that is what this checks.
 *
 * ## What it does
 *
 * 1. Requires `https:`.
 * 2. Resolves the hostname to **every** address it has.
 * 3. Refuses if *any* of them is loopback, private, link-local, CGNAT,
 *    multicast or otherwise not publicly routable. Any, not just the first: a
 *    host that returns one public and one internal address would otherwise pass
 *    the check and connect to the internal one.
 * 4. Returns the vetted address so the caller can connect **to that address**
 *    rather than re-resolving the name. Re-resolving reopens the hole — a DNS
 *    entry that answers public once and internal a moment later (rebinding)
 *    defeats any check that does not pin what it validated.
 *
 * Callers must still refuse redirects, require an image content type, and cap
 * the body: this function vets one hop, and a redirect is a second hop.
 */

export interface VettedTarget {
  url: URL;
  /** The validated address to connect to. */
  address: string;
  family: 4 | 6;
}

export type SsrfVerdict =
  | { ok: true; target: VettedTarget }
  | { ok: false; reason: string };

function ipv4IsPublic(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;

  if (a === 0) return false; // "this network"
  if (a === 10) return false; // RFC1918
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local, incl. 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return false; // RFC1918
  if (a === 192 && b === 168) return false; // RFC1918
  if (a === 192 && b === 0) return false; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51) return false; // TEST-NET-2
  if (a === 203 && b === 0) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast and reserved
  return true;
}

function ipv6IsPublic(ip: string): boolean {
  const lower = ip.toLowerCase().split('%')[0];

  if (lower === '::1' || lower === '::') return false;

  // IPv4-mapped (::ffff:a.b.c.d) is an IPv4 destination wearing a v6 name —
  // judge it by the address it actually reaches.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPublic(mapped[1]);

  const head = lower.split(':')[0];
  if (head.length === 0) return false;
  const leading = parseInt(head, 16);
  if (Number.isNaN(leading)) return false;

  if ((leading & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((leading & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((leading & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  return true;
}

/** True when the literal address is publicly routable. */
export function isPublicAddress(ip: string, family: 4 | 6): boolean {
  return family === 4 ? ipv4IsPublic(ip) : ipv6IsPublic(ip);
}

/**
 * Vets a URL for server-side fetching.
 *
 * `resolver` is injectable so the rules can be tested without DNS.
 */
export async function vetOutboundUrl(
  requested: string,
  resolver: (host: string) => Promise<Array<{ address: string; family: number }>> = (host) =>
    lookup(host, { all: true, verbatim: true }),
): Promise<SsrfVerdict> {
  let url: URL;
  try {
    url = new URL(requested);
  } catch {
    return { ok: false, reason: 'Malformed url' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Only https sources are fetched' };
  }
  // A literal address carries no name to validate and is never a legitimate
  // metadata host; refusing it removes the whole numeric-encoding class of
  // bypasses (decimal, octal, IPv4-in-IPv6) in one rule.
  if (/^\d|^\[/.test(url.hostname)) {
    return { ok: false, reason: 'Literal IP addresses are not fetched' };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await resolver(url.hostname);
  } catch {
    return { ok: false, reason: 'Host does not resolve' };
  }
  if (records.length === 0) {
    return { ok: false, reason: 'Host does not resolve' };
  }

  // Every address must be public — see the note above on split-horizon answers.
  for (const record of records) {
    const family = record.family === 6 ? 6 : 4;
    if (!isPublicAddress(record.address, family)) {
      return { ok: false, reason: 'Host resolves to a non-public address' };
    }
  }

  const chosen = records[0];
  return {
    ok: true,
    target: {
      url,
      address: chosen.address,
      family: chosen.family === 6 ? 6 : 4,
    },
  };
}
