import 'server-only';

/** Endpoint URLs copied from FluxRPC may include ?key=. Keep both credentials
 * and endpoint resolution server-side; never serialize this configuration. */
function trustedEndpoint(value: string, host: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === host && !url.port
      && !url.username && !url.password && !url.hash && ['/', '/v1', '/v1/'].includes(url.pathname)) return url;
  } catch { /* Report a fixed message, not a credential-bearing URL. */ }
  throw new Error('Rugcheck endpoint configuration is invalid.');
}

export function rugcheckConfig() {
  const endpoint = trustedEndpoint(process.env.RUGCHECK_API_ENDPOINT?.trim() || 'https://api.rugcheck.xyz', 'api.rugcheck.xyz');
  const apiKey = process.env.RUGCHECK_API_KEY?.trim() || endpoint.searchParams.get('key')?.trim() || '';
  // Send private API keys in headers, never in request URLs.
  endpoint.search = ''; endpoint.pathname = '/';
  const shieldValue = process.env.RUGCHECK_SHIELD_KEY?.trim();
  let shield: URL | null = null;
  let shieldInvalid = false;
  if (shieldValue) {
    try {
      shield = shieldValue.includes('://')
        ? trustedEndpoint(shieldValue, 'shield.rugcheck.xyz')
        : new URL('https://shield.rugcheck.xyz');
      const key = shieldValue.includes('://') ? shield.searchParams.get('key')?.trim() : shieldValue;
      if (!key) throw new Error('Missing Shield key.');
      shield.search = ''; shield.pathname = '/'; shield.searchParams.set('key', key);
    } catch { shield = null; shieldInvalid = true; }
  }
  return { endpoint, apiKey, shield, shieldInvalid };
}

export function rugcheckReportUrl(endpoint: URL, mint: string): string {
  const url = new URL(endpoint.href);
  url.pathname = `/v1/tokens/${encodeURIComponent(mint)}/report`;
  return url.href;
}
