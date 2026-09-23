// Compatibility endpoint: same authenticated prepared-swap contract as Quick Buy.
// Legacy unsigned quote/request payloads are rejected; they cannot produce fake confirmations.
export { POST } from '@/app/api/v1/trading/submit/route';
export const dynamic = 'force-dynamic';
