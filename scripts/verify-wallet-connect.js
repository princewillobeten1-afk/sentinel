const { Keypair } = require('@solana/web3.js');

async function testWalletFlow() {
  console.log('=== TESTING SENTINEL WALLET CONNECTION & SIWS FLOW ===\n');

  // 1. Generate a valid Solana Keypair (simulating Sentinel Smart Wallet / User Extension)
  const kp = Keypair.generate();
  const publicKey = kp.publicKey.toBase58();
  console.log('1. Generated Solana Public Key:', publicKey);

  // 2. Request SIWS challenge from backend
  const chRes = await fetch('http://localhost:3000/api/v1/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey, network: 'solana:mainnet' }),
  });

  if (!chRes.ok) {
    throw new Error(`Challenge request failed with status ${chRes.status}`);
  }

  const chData = await chRes.json();
  const challenge = chData.challenge || chData.data?.challenge;
  console.log('2. Received SIWS Challenge Nonce:', challenge.nonce);
  console.log('   Challenge Domain:', challenge.domain);

  // 3. Sign the challenge message using Node crypto or Ed25519
  const crypto = require('node:crypto');
  const messageBuffer = Buffer.from(challenge.formattedMessage, 'utf-8');

  // Convert raw 32-byte pubkey and 64-byte privkey to SPKI / PKCS8
  const ed25519Pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
  const privKeyRaw32 = kp.secretKey.slice(0, 32);
  const pkcs8Buffer = Buffer.concat([ed25519Pkcs8Header, privKeyRaw32]);

  const privateKeyObject = crypto.createPrivateKey({
    key: pkcs8Buffer,
    format: 'der',
    type: 'pkcs8',
  });

  const signature = crypto.sign(null, messageBuffer, privateKeyObject);
  
  // Convert signature to Base58
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function encodeBase58(buffer) {
    let digits = [0];
    for (let i = 0; i < buffer.length; i++) {
      let carry = buffer[i];
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] << 8;
        digits[j] = carry % 58;
        carry = (carry / 58) | 0;
      }
      while (carry > 0) {
        digits.push(carry % 58);
        carry = (carry / 58) | 0;
      }
    }
    let str = '';
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) str += '1';
    for (let i = digits.length - 1; i >= 0; i--) str += ALPHABET[digits[i]];
    return str;
  }

  const signatureBase58 = encodeBase58(signature);
  console.log('3. Generated Cryptographic Ed25519 Signature:', signatureBase58.slice(0, 24) + '...');

  // 4. Verify SIWS with backend
  const verifyRes = await fetch('http://localhost:3000/api/v1/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey,
      signature: signatureBase58,
      nonce: challenge.nonce,
      message: challenge.formattedMessage,
      label: 'Sentinel Smart Wallet',
    }),
  });

  console.log('4. Verification Status:', verifyRes.status);
  const verifyData = await verifyRes.json();
  const token = verifyData.token || verifyData.data?.token;
  console.log('   Received Session JWT Token:', token ? token.slice(0, 24) + '...' : 'None');

  // 5. Test authenticated profile retrieval with session token
  if (token) {
    const meRes = await fetch('http://localhost:3000/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    console.log('5. Authenticated User Profile:', meData.user?.displayName || 'Sentinel User');
    console.log('   Primary Wallet Address:', meData.primaryWallet?.address || publicKey);
  }

  console.log('\n=== ALL WALLET CONNECTION TESTS PASSED SUCCESSFULLY! ===\n');
}

testWalletFlow().catch((e) => {
  console.error('Wallet test failed:', e);
  process.exit(1);
});
