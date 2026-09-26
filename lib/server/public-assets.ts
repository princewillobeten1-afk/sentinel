import 'server-only';
import { createHash } from 'node:crypto';

// Only these public image CDNs are eligible. No query parameters, credentials,
// redirects or caller-supplied URLs are accepted by the serving route.
const hosts = new Set(['cdn.dexscreener.com', 'dd.dexscreener.com', 'img.jup.ag', 'img-cdn.jup.ag',
  'static.jup.ag', 'assets.geckoterminal.com', 'img.birdeye.so']);
const state = globalThis as typeof globalThis & { __sentinelPublicAssets?: Map<string, string> };
const assets = state.__sentinelPublicAssets ??= new Map<string, string>();
export function publicAssetUrl(value: string): string | undefined {
  let url: URL;
  try { url = new URL(value); } catch { return value; }
  if (!hosts.has(url.hostname.toLowerCase())) return value;
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search) return undefined;
  const id = createHash('sha256').update(url.href).digest('hex');
  assets.delete(id); assets.set(id, url.href);
  if (assets.size > 10_000) assets.delete(assets.keys().next().value!);
  return `/api/assets/${id}`;
}
export function resolvePublicAsset(id: string): string | undefined {
  return /^[a-f0-9]{64}$/.test(id) ? assets.get(id) : undefined;
}
