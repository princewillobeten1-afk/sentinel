import Client, {
  CommitmentLevel,
  SubscribeRequest,
  SubscribeUpdate,
} from '@triton-one/yellowstone-grpc';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from parent directory or local directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// Endpoint & Authentication
const ENDPOINT = process.env.HELIUS_GRPC_URL || 'https://laserstream-devnet-ewr.helius-rpc.com';
const TOKEN = process.env.HELIUS_GRPC_TOKEN || process.env.HELIUS_API_KEY || 'ba0b20f1-f08d-4949-b128-2be4eff7fe2c';

console.log('='.repeat(60));
console.log('🚀 Solana Yellowstone gRPC Stream (Helius Laserstream)');
console.log('='.repeat(60));
console.log(`📡 Endpoint: ${ENDPOINT}`);
console.log(`🔑 Token:    ${TOKEN ? `${TOKEN.slice(0, 8)}...${TOKEN.slice(-4)}` : 'None'}`);
console.log('='.repeat(60));

async function main() {
  const client = new Client(ENDPOINT, TOKEN, {
    'grpc.max_receive_message_length': 64 * 1024 * 1024,
    'grpc.max_send_message_length': 64 * 1024 * 1024,
  });

  console.log('Connecting to Yellowstone gRPC stream...');
  const stream = await client.subscribe();

  stream.on('data', (data: SubscribeUpdate) => {
    // 1. Slot Notifications
    if (data.slot) {
      console.log(`[SLOT] #${data.slot.slot} (Parent: #${data.slot.parent || 'none'}, Status: ${data.slot.status})`);
    }

    // 2. Account Updates
    if (data.account) {
      const pubkey = bs58.encode(Buffer.from(data.account.account?.pubkey || []));
      const owner = bs58.encode(Buffer.from(data.account.account?.owner || []));
      const lamports = data.account.account?.lamports;
      console.log(`[ACCOUNT] ${pubkey} | Owner: ${owner} | Balance: ${lamports} lamports | Slot: ${data.account.slot}`);
    }

    // 3. Transactions
    if (data.transaction) {
      const tx = data.transaction.transaction;
      if (tx) {
        const sig = tx.signature ? bs58.encode(Buffer.from(tx.signature)) : 'unknown';
        const isVote = tx.isVote;
        const err = tx.meta?.err;
        const slot = data.transaction.slot;
        
        console.log(
          `[TX] Sig: ${sig} | Slot: #${slot} | Status: ${err ? 'FAILED' : 'SUCCESS'} | Vote: ${isVote}`
        );
      }
    }

    // 4. Block Metadata
    if (data.blockMeta) {
      console.log(`[BLOCK_META] Slot: #${data.blockMeta.slot} | Blockhash: ${data.blockMeta.blockhash} | Executed Tx: ${data.blockMeta.executedTransactionCount}`);
    }

    // 5. Ping / Pong Keep-Alive
    if (data.ping) {
      (stream as any).write({
        accounts: {},
        slots: {},
        transactions: {},
        transactionsStatus: {},
        entry: {},
        blocks: {},
        blocksMeta: {},
        accountsDataSlice: [],
        ping: undefined,
        pong: { id: data.ping.id },
      });
    }
  });

  stream.on('error', (err: Error) => {
    console.error('❌ Stream Error:', err.message);
  });

  stream.on('end', () => {
    console.log('⚠️ Stream ended by remote server.');
  });

  stream.on('close', () => {
    console.log('🔒 Stream connection closed.');
  });

  // Subscribe Request Definition
  const subscribeRequest: SubscribeRequest = {
    accounts: {},
    slots: {
      slots_sub: {
        filterByCommitment: true,
      },
    },
    transactions: {
      all_txs: {
        vote: false,
        failed: false,
        signature: undefined,
        accountInclude: [],
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    entry: {},
    blocks: {},
    blocksMeta: {},
    commitment: CommitmentLevel.PROCESSED,
    accountsDataSlice: [],
    ping: undefined,
  };

  // Dispatch subscription
  await new Promise<void>((resolve, reject) => {
    stream.write(subscribeRequest, (err: any) => {
      if (err) {
        console.error('❌ Subscription request write failed:', err);
        reject(err);
      } else {
        console.log('✅ Subscription request successfully sent! Listening for events...');
        resolve();
      }
    });
  });
}

main().catch((err) => {
  console.error('Fatal error in gRPC stream:', err);
  process.exit(1);
});
