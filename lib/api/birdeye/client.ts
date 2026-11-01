import { fetchWithTimeout } from './http-timeout';

const MAX_429_RETRIES = 3;
const BASE_429_BACKOFF_MS = 1_200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class BirdeyeClient {
  private readonly baseUrl = 'https://public-api.birdeye.so';
  private readonly explicitApiKey?: string;
  private readonly chain: string;

  constructor(apiKey?: string, chain: string = 'solana') {
    this.explicitApiKey = apiKey?.trim() || undefined;
    this.chain = chain;
  }

  private resolveApiKey(): string {
    return this.explicitApiKey || process.env.BIRDEYE_API_KEY?.trim() || '';
  }

  async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const apiKey = this.resolveApiKey();
    if (!apiKey) {
      console.warn('BirdeyeClient called without API key');
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-chain': this.chain,
      ...((options?.headers as Record<string, string>) || {}),
    };

    if (apiKey) {
      headers['X-API-KEY'] = apiKey;
    }

    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
      const response = await fetchWithTimeout(url, {
        ...options,
        headers,
      });

      if (response.status === 429) {
        if (attempt === MAX_429_RETRIES) {
          throw new Error('Birdeye API Rate Limit Exceeded (429)');
        }
        const retryAfter = Number(response.headers.get('retry-after'));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(10_000, retryAfter * 1_000)
            : BASE_429_BACKOFF_MS * (attempt + 1);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Birdeye API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(`Birdeye API Data Error: ${data.message || 'Unknown error'}`);
      }

      return data.data as T;
    }

    throw new Error('Birdeye API Rate Limit Exceeded (429)');
  }
}

export const birdeye = new BirdeyeClient();
