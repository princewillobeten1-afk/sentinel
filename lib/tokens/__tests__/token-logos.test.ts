import { describe, it, expect } from 'vitest';
import {
  normalizeIpfsUrl,
  resolveTokenLogoCandidates,
  resolveTokenLogoUrl,
  getTokenGradient,
} from '../token-logos';

describe('token-logos', () => {
  describe('normalizeIpfsUrl', () => {
    it('rewrites ipfs:// URIs to pump.mypinata.cloud', () => {
      const cid = 'bafkreidwspanvduvfzm22atp7hx74zlovapz3vi2xwztotz33rv75lu3nm';
      expect(normalizeIpfsUrl(`ipfs://${cid}`)).toBe(`https://pump.mypinata.cloud/ipfs/${cid}`);
    });

    it('rewrites ipfs.io gateways to pump.mypinata.cloud', () => {
      const cid = 'bafkreidwspanvduvfzm22atp7hx74zlovapz3vi2xwztotz33rv75lu3nm';
      expect(normalizeIpfsUrl(`https://ipfs.io/ipfs/${cid}`)).toBe(
        `https://pump.mypinata.cloud/ipfs/${cid}`
      );
    });

    it('rewrites nftstorage.link subdomains to pump.mypinata.cloud', () => {
      const cid = 'bafkreicnqsbhpzxiasdm5esr7fqi3vcjvcbfefo4sq4y3ff747rfqf7w7i';
      expect(normalizeIpfsUrl(`https://${cid}.ipfs.nftstorage.link`)).toBe(
        `https://pump.mypinata.cloud/ipfs/${cid}`
      );
    });

    it('leaves standard non-IPFS https URLs untouched', () => {
      const url = 'https://gateway.irys.xyz/DxqTmCuXLPYJ98ngYYE4ZFC2ZiRT3v9E6hkhX9yjTRPd';
      expect(normalizeIpfsUrl(url)).toBe(url);
    });
  });

  describe('resolveTokenLogoCandidates', () => {
    it('returns pump.fun image candidates when mint ends in pump and src is absent', () => {
      const mint = '6ZG6fMHaE7NpubJr16G8nFLBg91rH5kU5SVpqUmQpump';
      const candidates = resolveTokenLogoCandidates({ mint });
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates).toContain(
        `/api/v1/media/token-icon?url=${encodeURIComponent(`https://images.pump.fun/coin-image/${mint}?variant=80x80`)}`
      );
      expect(candidates).toContain(`https://images.pump.fun/coin-image/${mint}?variant=80x80`);
    });

    it('returns normalized IPFS candidates when src is ipfs.io', () => {
      const cid = 'bafkreidwspanvduvfzm22atp7hx74zlovapz3vi2xwztotz33rv75lu3nm';
      const src = `https://ipfs.io/ipfs/${cid}`;
      const candidates = resolveTokenLogoCandidates({ src });
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]).toBe(
        `/api/v1/media/token-icon?url=${encodeURIComponent(`https://pump.mypinata.cloud/ipfs/${cid}`)}`
      );
    });

    it('returns known logo for SOL mint', () => {
      const candidates = resolveTokenLogoCandidates({
        mint: 'So11111111111111111111111111111111111111112',
      });
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]).toContain('/api/v1/media/token-icon');
    });
  });

  describe('resolveTokenLogoUrl', () => {
    it('returns the first candidate URL', () => {
      const mint = '6ZG6fMHaE7NpubJr16G8nFLBg91rH5kU5SVpqUmQpump';
      const url = resolveTokenLogoUrl({ mint });
      expect(url).not.toBeNull();
      expect(url).toContain('/api/v1/media/token-icon');
    });

    it('returns null when no src, mint or symbol matches', () => {
      expect(resolveTokenLogoUrl({})).toBeNull();
    });
  });

  describe('getTokenGradient', () => {
    it('returns consistent gradient class for seed', () => {
      const g1 = getTokenGradient('CATE');
      const g2 = getTokenGradient('CATE');
      expect(g1).toBe(g2);
      expect(g1).toContain('from-');
    });
  });
});
