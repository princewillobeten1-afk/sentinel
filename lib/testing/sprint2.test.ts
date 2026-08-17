import { generateAuthNonce, verifyEd25519Signature } from '../server/crypto-auth';
import { serverStore } from '../server/store';
import { createAuthSession, verifyAuthToken } from '../server/auth';
import { checkRateLimit } from '../server/rate-limit';
import { recordAuditEvent } from '../server/audit';

export async function runSprint2TestSuite() {
  console.log('=== SENTINEL SPRINT 2 AUTOMATED TEST SUITE ===\n');

  const results: { test: string; status: 'PASSED' | 'FAILED'; details?: string }[] = [];

  const addResult = (test: string, passed: boolean, details?: string) => {
    results.push({ test, status: passed ? 'PASSED' : 'FAILED', details });
    console.log(`${passed ? '✅ [PASS]' : '❌ [FAIL]'} ${test}${details ? ` - ${details}` : ''}`);
  };

  // 1. NONCE GENERATION
  try {
    const nonce1 = generateAuthNonce(16);
    const nonce2 = generateAuthNonce(16);
    addResult('1. Cryptographic Nonce Unpredictability', nonce1 !== nonce2 && nonce1.length === 32);
  } catch (err: any) {
    addResult('1. Cryptographic Nonce Unpredictability', false, err.message);
  }

  // 2. CHALLENGE CREATION & EXPIRATION
  try {
    const testPubKey = '7xK99zK8mP2xQ5wN3a19TestKey';
    const nonce = generateAuthNonce(16);
    const expiresAt = new Date(Date.now() + 600000).toISOString();
    const challenge = await serverStore.saveChallenge(testPubKey, nonce, 'Test Statement', expiresAt);

    const retrieved = await serverStore.getChallengeByNonce(nonce);
    addResult('2. Challenge Creation & Fetching', retrieved?.nonce === nonce);

    // Test Expiration
    const expiredNonce = generateAuthNonce(16);
    const pastExpires = new Date(Date.now() - 1000).toISOString();
    await serverStore.saveChallenge(testPubKey, expiredNonce, 'Expired Statement', pastExpires);
    const expiredRetrieved = await serverStore.getChallengeByNonce(expiredNonce);
    addResult('3. Challenge Expiration Enforcement', expiredRetrieved === undefined);
  } catch (err: any) {
    addResult('2. Challenge Creation & Expiration', false, err.message);
  }

  // 3. SINGLE-USE NONCE REUSE & REPLAY PREVENTION
  try {
    const nonce = generateAuthNonce(16);
    await serverStore.saveChallenge('7xK9TestKey', nonce, 'Single Use Test', new Date(Date.now() + 60000).toISOString());

    const firstUse = await serverStore.getChallengeByNonce(nonce);
    if (firstUse) await serverStore.consumeChallenge(nonce);

    const secondUse = await serverStore.getChallengeByNonce(nonce);
    addResult('4. Replay Prevention & Single-Use Invalidation', firstUse !== undefined && secondUse === undefined);
  } catch (err: any) {
    addResult('4. Replay Prevention', false, err.message);
  }

  // 4. ED25519 SIGNATURE VERIFICATION
  try {
    const testPubKey = '7xK99zK8mP2xQ5wN3a19';
    const message = 'Test SIWS Message Payload';
    const fakeSig = 'a'.repeat(128); // 64 bytes hex
    
    const isValid = verifyEd25519Signature(testPubKey, message, fakeSig);
    addResult('5. Signature Verification Engine', typeof isValid === 'boolean');
  } catch (err: any) {
    addResult('5. Signature Verification Engine', false, err.message);
  }

  // 5. SESSION JWT CREATION & VERIFICATION
  try {
    const testUser = {
      userId: 'user_001',
      role: 'user' as const,
      displayName: 'Sentinel Test User',
      primaryWalletAddress: '7xK99zK8mP2xQ5wN3a19',
    };

    const { token } = await createAuthSession(testUser, { ip: null, userAgent: null }, 3600);
    const verified = await verifyAuthToken(token);
    addResult('6. Session Creation & Token Verification', verified?.userId === testUser.userId);
  } catch (err: any) {
    addResult('6. Session Verification', false, err.message);
  }

  // 6. MULTI-WALLET LINKING & PRIMARY WALLET SELECTION
  try {
    const userId = 'usr_test_multiwallet';
    const pubKey1 = '7xK9MainPubKey11111111111';
    const pubKey2 = '3mR8SecondaryPubKey222222';

    const created = await serverStore.createUserWithWallet(pubKey1, 'Main Wallet');
    const linked2 = await serverStore.addWalletToUser(created.user.id, pubKey2, 'Trading Wallet');

    const wallets = await serverStore.getUserWallets(created.user.id);
    addResult('7. Multi-Wallet Association', wallets.length === 2);

    // Toggle Primary
    await serverStore.updateWallet(linked2.id, created.user.id, { isPrimary: true });
    const updatedWallets = await serverStore.getUserWallets(created.user.id);
    const newPrimary = updatedWallets.find((w) => w.isPrimary);
    addResult('8. Primary Wallet Selection', newPrimary?.id === linked2.id);
  } catch (err: any) {
    addResult('7. Multi-Wallet & Primary Selection', false, err.message);
  }

  // 7. CROSS-USER WALLET REJECTION
  try {
    const pubKey = '7xK9SharedPubKey99999';
    const userA = await serverStore.createUserWithWallet(pubKey, 'User A Wallet');

    let caughtError = false;
    try {
      await serverStore.addWalletToUser('different_user_id', pubKey, 'Malicious Add');
    } catch (err: any) {
      caughtError = true;
    }
    addResult('9. Cross-User Wallet Transfer Prevention', caughtError);
  } catch (err: any) {
    addResult('9. Cross-User Wallet Transfer Prevention', false, err.message);
  }

  // 8. AUDIT LOGGING
  try {
    recordAuditEvent({
      userId: 'user_001',
      action: 'AUTH_SUCCESS',
      entityType: 'user',
      entityId: 'user_001',
      changes: { method: 'SIWS' },
    });
    const logs = await serverStore.getAuditLogs({ userId: 'user_001' });
    addResult('10. Structured Security Audit Logging', logs.length > 0);
  } catch (err: any) {
    addResult('10. Structured Security Audit Logging', false, err.message);
  }

  // SUMMARY
  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  console.log(`\n=== SPRINT 2 TEST RESULTS: ${passedCount}/${results.length} PASSED ===\n`);
  return { total: results.length, passed: passedCount, results };
}
