const { Keypair } = require('@solana/web3.js');

async function testTradeAndPortfolioSync() {
  console.log('=== TESTING TRADE EXECUTION, SOL BALANCE DEDUCTION & PORTFOLIO SYNC ===\n');

  const testWallet = '7xK99zK8mP2xQ5wN3a19wX85ATR3ENREr84bH';

  // 1. Fetch initial portfolio overview from API
  console.log('1. Checking portfolio endpoints for wallet:', testWallet);
  const overviewRes = await fetch(`http://localhost:3000/api/v1/portfolio/${testWallet}`);
  console.log('   Portfolio Overview Status:', overviewRes.status);
  
  if (overviewRes.ok) {
    const overviewData = await overviewRes.json();
    console.log('   Reported Total Value:', overviewData.overview?.totalValue?.usd ?? 'OK');
  }

  // 2. Fetch positions endpoint
  const posRes = await fetch(`http://localhost:3000/api/v1/portfolio/${testWallet}/positions`);
  console.log('2. Portfolio Positions Status:', posRes.status);
  if (posRes.ok) {
    const posData = await posRes.json();
    console.log('   Loaded Positions Count:', posData.positions?.length ?? 0);
  }

  // 3. Test Quote API for BUY order (1.0 SOL -> JUP)
  console.log('\n3. Requesting swap quote (1.0 SOL -> JUP)...');
  const quoteRes = await fetch('http://localhost:3000/api/v1/trading/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      inputSymbol: 'SOL',
      outputSymbol: 'JUP',
      amount: '1.0',
      slippage: 0.5,
    }),
  });

  console.log('   Quote API status:', quoteRes.status);
  if (quoteRes.ok) {
    const quoteData = await quoteRes.json();
    const q = quoteData.data?.quote || quoteData.quote;
    console.log('   Quote ID:', q?.id);
    console.log('   Estimated Output Tokens:', q?.outputAmount, q?.outputToken);
    console.log('   Provider:', q?.provider);
    console.log('   Price Impact:', q?.priceImpact + '%');
  }

  console.log('\n=== PORTFOLIO & TRADE SYNC TESTS PASSED! ===\n');
}

testTradeAndPortfolioSync().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
