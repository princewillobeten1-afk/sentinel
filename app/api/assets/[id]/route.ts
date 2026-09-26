import { resolvePublicAsset } from '@/lib/server/public-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BYTES = 2 * 1024 * 1024;
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const url = resolvePublicAsset(params.id);
  if (!url) return new Response(null, { status: 404 });
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5_000),
      next: { revalidate: 3600 }, headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif' } });
    const mime = response.headers.get('content-type')?.split(';')[0] ?? '';
    if (!response.ok || !/^image\/(png|jpeg|webp|gif|avif)$/.test(mime)
      || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) return new Response(null, { status: 404 });
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES) { await reader.cancel(); return new Response(null, { status: 413 }); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': mime,
      'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch { return new Response(null, { status: 404 }); }
}
