async function verify() {
  const tests = [
    { type: 'CA Search', query: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump' },
    { type: 'Symbol Search', query: 'CATCULT' },
    { type: 'Name Search', query: 'CyberBank' },
    { type: 'Token Lookup', query: 'sanic' },
  ];

  console.log('=== VERIFYING GLOBAL SEARCH API ===\n');

  for (const t of tests) {
    const res = await fetch('http://localhost:3000/api/v1/tokens/search?q=' + encodeURIComponent(t.query));
    const json = await res.json();
    const items = json.data?.items || json.items || [];
    console.log(`[${t.type}] Query="${t.query}" -> Returned ${items.length} result(s)`);
    if (items.length > 0) {
      const top = items[0];
      console.log(`  -> Found: ${top.name} ($${top.symbol}) | Mint: ${top.mint} | Price: $${top.priceUsd} | MC: $${top.marketCapUsd} | Source: ${top.source}`);
      console.log(`     Socials: Twitter: ${top.twitterUrl || 'none'} | Website: ${top.websiteUrl || 'none'}`);
    }
  }

  console.log('\n=== VERIFYING DIRECT TOKEN API FOR TRADE TERMINAL ===\n');
  const tokenRes = await fetch('http://localhost:3000/api/v1/tokens/solana/77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump');
  const tokenJson = await tokenRes.json();
  const token = tokenJson.data?.token || tokenJson.token;
  console.log('Direct Token lookup for 77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump:');
  console.log('  -> Name:', token.name, `($${token.symbol})`);
  console.log('  -> Price:', `$${token.priceUsd}`);
  console.log('  -> 24h Change:', `${token.priceChange24h}%`);
  console.log('  -> Socials:', token.socials);
  console.log('  -> Explorer:', token.explorerUrl);
}

verify();
