import { describe, it, expect } from 'vitest';
import { isPublicAddress, vetOutboundUrl } from '../ssrf-guard';

const resolvesTo = (...addresses: Array<[string, number]>) =>
  async () => addresses.map(([address, family]) => ({ address, family }));

describe('isPublicAddress — the ranges an SSRF actually targets', () => {
  it('refuses the cloud metadata address', () => {
    // The single most-abused SSRF destination.
    expect(isPublicAddress('169.254.169.254', 4)).toBe(false);
  });

  it('refuses loopback, RFC1918, CGNAT and multicast', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.4.4', '172.31.255.255',
                      '192.168.1.1', '100.64.0.1', '224.0.0.1', '0.0.0.0']) {
      expect(isPublicAddress(ip, 4), ip).toBe(false);
    }
  });

  it('allows ordinary public addresses', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '104.18.32.7', '172.15.0.1', '172.32.0.1']) {
      expect(isPublicAddress(ip, 4), ip).toBe(true);
    }
  });

  it('refuses IPv6 loopback, unique-local and link-local', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1']) {
      expect(isPublicAddress(ip, 6), ip).toBe(false);
    }
    expect(isPublicAddress('2606:4700::1111', 6)).toBe(true);
  });

  it('judges an IPv4-mapped v6 address by the IPv4 it reaches', () => {
    // ::ffff:127.0.0.1 is loopback wearing a v6 name.
    expect(isPublicAddress('::ffff:127.0.0.1', 6)).toBe(false);
    expect(isPublicAddress('::ffff:8.8.8.8', 6)).toBe(true);
  });
});

describe('vetOutboundUrl', () => {
  it('accepts a normal https host and returns the address to pin', async () => {
    const v = await vetOutboundUrl('https://gateway.irys.xyz/abc.png', resolvesTo(['104.18.32.7', 4]));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.target.address).toBe('104.18.32.7');
      expect(v.target.url.hostname).toBe('gateway.irys.xyz');
    }
  });

  it('refuses http', async () => {
    const v = await vetOutboundUrl('http://example.com/a.png', resolvesTo(['8.8.8.8', 4]));
    expect(v).toMatchObject({ ok: false, reason: 'Only https sources are fetched' });
  });

  it('refuses a literal IP, which removes the numeric-encoding bypasses', async () => {
    for (const u of ['https://169.254.169.254/latest/meta-data/', 'https://[::1]/x.png']) {
      expect(await vetOutboundUrl(u, resolvesTo(['8.8.8.8', 4]))).toMatchObject({ ok: false });
    }
  });

  it('refuses a host that resolves to an internal address', async () => {
    const v = await vetOutboundUrl('https://evil.example/x.png', resolvesTo(['127.0.0.1', 4]));
    expect(v).toMatchObject({ ok: false, reason: 'Host resolves to a non-public address' });
  });

  it('refuses when ANY answer is internal, not just the first', async () => {
    // A split answer would otherwise pass the check and connect internally.
    const v = await vetOutboundUrl(
      'https://split.example/x.png',
      resolvesTo(['93.184.216.34', 4], ['10.0.0.7', 4]),
    );
    expect(v).toMatchObject({ ok: false, reason: 'Host resolves to a non-public address' });
  });

  it('refuses a host that does not resolve', async () => {
    const v = await vetOutboundUrl('https://nowhere.example/x.png', async () => []);
    expect(v).toMatchObject({ ok: false, reason: 'Host does not resolve' });
  });

  it('accepts the gateways the old allowlist blocked', async () => {
    // The regression this replaces: 52% of live token icons were refused for
    // no reason beyond not appearing on a hand-written list.
    for (const host of ['gateway.irys.xyz', 'metadata.j7tracker.io', 'xstocks-metadata.backed.fi',
                        'desperate-moccasin-minnow.myfilebase.com', 'axiomtrading-v2.axiom-cdn.io']) {
      const v = await vetOutboundUrl(`https://${host}/icon.png`, resolvesTo(['104.18.32.7', 4]));
      expect(v.ok, host).toBe(true);
    }
  });
});
