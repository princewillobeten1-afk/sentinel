import { describe, expect, it } from 'vitest';
import { parseBitqueryOwners, profileFromBitqueryOwners } from '../bitquery-ownership';

const mint = '4NLjoZAt6Sd47oTs2hb2JRA7qiJzHmWQfDeNvtJPpump';
const a = '3gp324PkTrX6Fhp37kaHP1SdhWKsDV7cvRRPvuDPbaRC';
const b = 'BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s';
const c = 'Gcssrb8kbM3GP3xJTKYQ2e6Qbaqma6qumdiMBNzVXVuu';

describe('Bitquery recent ownership', () => {
  it('parses the documented latest-slot owner balances, including closed-out owners', () => {
    const rows = parseBitqueryOwners({ data: { Solana: { BalanceUpdates: [
      { BalanceUpdate: { Account: { Owner: a }, balance: '1010531302.884215' } },
      { BalanceUpdate: { Account: { Owner: b }, balance: '989468697.115785' } },
      { BalanceUpdate: { Account: { Owner: c }, balance: '0.000000' } },
    ] } } });
    expect(rows).toHaveLength(3);
    const profile = profileFromBitqueryOwners(mint, rows!, 2_000_000_000, b);
    expect(profile).toMatchObject({ top10Pct: 100, totalHolders: 2, devPct: 49.4734 });
    expect(profile?.snipersPct).toBeNull();
  });

  it('rejects a truncated or out-of-window subset rather than reporting a safe concentration', () => {
    expect(profileFromBitqueryOwners(mint, [{ owner: a, balance: 200 }], 1_000)).toBeNull();
    expect(profileFromBitqueryOwners(mint, [{ owner: a, balance: 1_100 }], 1_000)).toBeNull();
  });

  it('rejects malformed and duplicate rows and GraphQL errors', () => {
    expect(parseBitqueryOwners({ errors: [{ message: 'quota' }] })).toBeNull();
    expect(parseBitqueryOwners({ data: { Solana: { BalanceUpdates: [
      { BalanceUpdate: { Account: { Owner: a }, balance: '1' } },
      { BalanceUpdate: { Account: { Owner: a }, balance: '2' } },
    ] } } })).toBeNull();
  });
});
