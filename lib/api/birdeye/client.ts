import { fetchWithTimeout } from './http-timeout';

export class BirdeyeClient {
  private readonly baseUrl = 'https://public-api.birdeye.so';
  private readonly apiKey: string;
  private readonly chain: string;

  constructor(apiKey?: string, chain: string = 'solana') {
    this.apiKey = apiKey || process.env.BIRDEYE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('BirdeyeClient initialized without API key');
    }
    this.chain = chain;
  }

  async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'x-chain': this.chain,
      ...(options?.headers as Record<string, string> || {})
    };

    if (this.apiKey) {
      headers['X-API-KEY'] = this.apiKey;
    }

    const response = await fetchWithTimeout(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Birdeye API Rate Limit Exceeded (429)');
      }
      throw new Error(`Birdeye API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(`Birdeye API Data Error: ${data.message || 'Unknown error'}`);
    }

    return data.data as T;
  }
}

export const birdeye = new BirdeyeClient();
