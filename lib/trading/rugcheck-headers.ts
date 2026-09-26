import 'server-only';
import { rugcheckConfig } from './rugcheck-config';

/** FluxRPC-issued Rugcheck keys use X-API-KEY, not the wallet-login JWT header.
 * https://fluxrpc.com/docs/rugcheck#authentication
 * Read at request time because the custom server can load .env after imports. */
export function rugcheckHeaders(): Record<string, string> {
  const key = rugcheckConfig().apiKey;
  return {
    Accept: 'application/json',
    ...(key ? { 'X-API-KEY': key } : {}),
  };
}
