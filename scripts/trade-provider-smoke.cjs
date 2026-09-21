// Read-only provider capability check. Never print credentials or signed payloads.
require('@next/env').loadEnvConfig(process.cwd());
const WS = require('ws');
const SOL = 'So11111111111111111111111111111111111111112';
async function read(label, url, init = {}) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
    const body = await response.json().catch(() => null);
    const message = JSON.stringify(body?.message ?? body?.error ?? '').toLowerCase();
    console.log(JSON.stringify({ provider: label, http: response.status, success: body?.success,
      quotaExhausted: /quota|compute units|cu limit|credits|usage limit/.test(message),
      shape: body && typeof body === 'object' ? Object.keys(body).slice(0, 12) : [] }));
    return response.ok ? body : null;
  } catch (error) { console.log(JSON.stringify({ provider: label, error: error.name })); return null; }
}
async function main() {
  const wsMode = process.argv.includes('--price') ? 'price' : 'stats';
  console.log(JSON.stringify({ configured: { jupiter: Boolean(process.env.JUPITER_API_KEY), helius: Boolean(process.env.HELIUS_API_KEY), birdeye: Boolean(process.env.BIRDEYE_API_KEY) } }));
  const jupBase = process.env.JUPITER_API_KEY ? 'https://api.jup.ag' : 'https://lite-api.jup.ag';
  const recent = await read('Jupiter recent', `${jupBase}/tokens/v2/recent`, { headers: process.env.JUPITER_API_KEY ? {'x-api-key': process.env.JUPITER_API_KEY} : {} });
  const token = Array.isArray(recent) ? recent.find(token => token.dev) : null;
  const mint = token?.id || SOL;
  console.log(JSON.stringify({ tokenShape: token ? Object.keys(token) : [], auditShape: token?.audit ? Object.keys(token.audit) : [], sampleMint: mint }));
  if (process.env.BIRDEYE_API_KEY) {
    const headers = {'X-API-KEY': process.env.BIRDEYE_API_KEY, 'x-chain': 'solana'};
    await read('Birdeye holder profile', `https://public-api.birdeye.so/token/v1/holder-profile?token_address=${mint}`, {headers});
    if (token?.dev) {
      const pnl = await read('Birdeye token PnL', `https://public-api.birdeye.so/wallet/v2/pnl?wallet=${token.dev}&token_addresses=${mint}&pnl_method=wac`, { headers });
      if (pnl?.data) console.log(JSON.stringify({ pnlDataShape: Object.keys(pnl.data), tokenShape: Object.keys(pnl.data.tokens?.[mint] || {}) }));
    }
    await new Promise(resolve => {
      const socket = new WS(`wss://public-api.birdeye.so/socket/solana?x-api-key=${process.env.BIRDEYE_API_KEY}`, 'echo-protocol', {
        headers: { Origin: 'ws://public-api.birdeye.so', 'Sec-WebSocket-Origin': 'ws://public-api.birdeye.so' },
        handshakeTimeout: 7000,
      });
      const timer = setTimeout(() => { socket.terminate(); resolve(); }, 10000);
      socket.on('error', () => { console.log(JSON.stringify({provider:'Birdeye WebSocket', connected:false})); });
      socket.on('open', () => {
        console.log(JSON.stringify({provider:'Birdeye WebSocket', connected:true}));
        socket.send(JSON.stringify(wsMode === 'price'
          ? { type:'SUBSCRIBE_PRICE', data:{ queryType:'simple', chartType:'1m', address:mint, currency:'usd' } }
          : { type:'SUBSCRIBE_TOKEN_STATS', data:{ address:[mint], select:{ price:true, trade_data:{volume:true,trade:true,price_change:true,intervals:['5m','1h']}, marketcap:true, liquidity:true } } }));
      });
      socket.on('message', raw => { try { const message = JSON.parse(String(raw)); const detail = String(message.data || ''); console.log(JSON.stringify({ provider:'Birdeye WebSocket message', type:message.type, dataKeys: typeof message.data === 'object' ? Object.keys(message.data || {}) : [], rejection: message.type === 'ERROR' ? (/api.?key|origin/i.test(detail) ? 'origin-or-key' : /permission|package|premium|plan/i.test(detail) ? 'plan-access' : 'subscription') : undefined })); } catch {} });
      socket.on('close', code => { clearTimeout(timer); console.log(JSON.stringify({provider:'Birdeye WebSocket closed', code})); resolve(); });
    });
  }
  if (process.env.HELIUS_API_KEY && token?.dev) {
    const funding = await read('Helius funded-by', `https://api.helius.xyz/v1/wallet/${token.dev}/funded-by`, { headers: {'X-Api-Key':process.env.HELIUS_API_KEY} });
    if (funding) console.log(JSON.stringify({ fundingShape: Object.keys(funding) }));
  }
  const report = await read('Rugcheck report', `https://api.rugcheck.xyz/v1/tokens/${mint}/report`);
  if (report) console.log(JSON.stringify({ reportFields: Object.keys(report), lp: report.markets?.slice(0,2).map(market => market.lp), fileMeta: report.fileMeta }));
}
main().catch(error => { console.log(JSON.stringify({ error: error.name })); process.exitCode = 1; });
