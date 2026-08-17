import { describe, it, expect, beforeEach } from 'vitest';
import { SolanaAdapter } from '../solana-adapter';
import { EthereumAdapter, BaseAdapter, EvmAdapter } from '../evm-adapter';
import { RpcProviderPool } from '../rpc-provider';
import { BlockchainService } from '../blockchain-service';

describe('Sprint 44: Multi-Chain Adapters & RPC Abstraction Layer', () => {
  let rpcPool: RpcProviderPool;
  let solanaAdapter: SolanaAdapter;
  let ethAdapter: EthereumAdapter;
  let baseAdapter: BaseAdapter;

  beforeEach(() => {
    rpcPool = new RpcProviderPool([
      {
        id: 'mock_sol_primary',
        name: 'Solana Primary Mock',
        chainId: 'solana',
        url: 'https://mock-solana.primary.rpc',
        tier: 'primary',
        weight: 100,
        maxRps: 50,
        timeoutMs: 3000,
      },
      {
        id: 'mock_sol_secondary',
        name: 'Solana Secondary Mock',
        chainId: 'solana',
        url: 'https://mock-solana.secondary.rpc',
        tier: 'secondary',
        weight: 90,
        maxRps: 50,
        timeoutMs: 3000,
      },
      {
        id: 'mock_eth_primary',
        name: 'Ethereum Primary Mock',
        chainId: 'ethereum',
        url: 'https://mock-eth.primary.rpc',
        tier: 'primary',
        weight: 100,
        maxRps: 50,
        timeoutMs: 3000,
      },
      {
        id: 'mock_base_primary',
        name: 'Base Primary Mock',
        chainId: 'base',
        url: 'https://mock-base.primary.rpc',
        tier: 'primary',
        weight: 100,
        maxRps: 50,
        timeoutMs: 3000,
      },
    ]);

    solanaAdapter = new SolanaAdapter(rpcPool);
    ethAdapter = new EthereumAdapter(rpcPool);
    baseAdapter = new BaseAdapter(rpcPool);
  });

  it('retrieves latest canonical block with proper status and parent hash on Solana', async () => {
    const block = await solanaAdapter.getLatestBlock('CONFIRMED');
    expect(block.chainId).toBe('solana');
    expect(block.number).toBeGreaterThan(0);
    expect(block.hash).toBeDefined();
    expect(block.parentHash).toBeDefined();
    expect(block.status).toBe('CANONICAL');
    expect(block.finality).toBe('CONFIRMED');
  });

  it('retrieves and normalizes EVM blocks on Ethereum and Base', async () => {
    const ethBlock = await ethAdapter.getLatestBlock('FINALIZED');
    expect(ethBlock.chainId).toBe('ethereum');
    expect(ethBlock.number).toBeGreaterThan(0);
    expect(ethBlock.finality).toBe('FINALIZED');

    const baseBlock = await baseAdapter.getLatestBlock('CONFIRMED');
    expect(baseBlock.chainId).toBe('base');
    expect(baseBlock.number).toBeGreaterThan(0);
  });

  it('normalizes Solana transactions with lamports conversion and classification', async () => {
    const tx = await solanaAdapter.getTransaction('5Kz7N8v9...');
    expect(tx).not.toBeNull();
    expect(tx?.chainId).toBe('solana');
    expect(tx?.valueFormatted).toBe(1.5);
    expect(tx?.fee).toBe(0.000005);
    expect(tx?.classification).toBeDefined();
    expect(tx?.status).toBe('SUCCESS');
  });

  it('normalizes EVM transactions with wei to ETH conversion and fee calculation', async () => {
    const tx = await ethAdapter.getTransaction('0xabc123...');
    expect(tx).not.toBeNull();
    expect(tx?.chainId).toBe('ethereum');
    expect(tx?.valueFormatted).toBe(1.5);
    expect(tx?.fee).toBeGreaterThan(0);
    expect(tx?.classification).toBeDefined();
    expect(tx?.status).toBe('SUCCESS');
  });

  it('resolves token metadata and native/token balances across chains', async () => {
    // Solana SPL Token
    const solMeta = await solanaAdapter.getTokenMetadata('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(solMeta?.symbol).toBe('USDC');
    expect(solMeta?.decimals).toBe(6);

    const solBal = await solanaAdapter.getNativeBalance('7Wc8YQe9n8QY5PzN1pXm8x9y7z2a1b3c4d5e6f7g8h');
    expect(solBal.symbol).toBe('SOL');
    expect(solBal.balanceFormatted).toBe(3.45);

    // EVM Token
    const baseMeta = await baseAdapter.getTokenMetadata('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(baseMeta?.symbol).toBe('USDC');
    expect(baseMeta?.decimals).toBe(6);

    const ethBal = await ethAdapter.getNativeBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(ethBal.symbol).toBe('ETH');
    expect(ethBal.balanceFormatted).toBe(4.2);
  });

  it('performs automatic RPC failover from primary to secondary provider on error', async () => {
    let callCount = 0;
    const { result, usedProvider } = await rpcPool.executeWithFailover('solana', 'testMethod', async (provider) => {
      callCount++;
      if (provider.id === 'mock_sol_primary') {
        throw new Error('Primary node connection refused');
      }
      return { success: true, slot: 295480200 };
    });

    expect(result.success).toBe(true);
    expect(usedProvider.id).toBe('mock_sol_secondary');
    expect(callCount).toBeGreaterThanOrEqual(2);

    // Verify metrics and health status tracking
    const metrics = rpcPool.getMetrics();
    const primaryMetric = metrics.find((m) => m.providerId === 'mock_sol_primary');
    const secondaryMetric = metrics.find((m) => m.providerId === 'mock_sol_secondary');

    expect(primaryMetric?.failedRequests).toBeGreaterThan(0);
    expect(secondaryMetric?.successfulRequests).toBe(1);
  });

  it('records request trace with unique requestId and duration for debugging', async () => {
    await rpcPool.executeWithFailover('ethereum', 'eth_blockNumber', async () => ({ block: 19450000 }));
    const traces = rpcPool.getTraces();

    expect(traces.length).toBeGreaterThan(0);
    const lastTrace = traces[traces.length - 1];
    expect(lastTrace.requestId).toMatch(/^rpc_ethereum_/);
    expect(lastTrace.chainId).toBe('ethereum');
    expect(lastTrace.status).toBe('SUCCESS');
    expect(lastTrace.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('BlockchainService aggregates health summaries for all registered adapters', async () => {
    const service = BlockchainService.getInstance();
    const health = await service.getHealthSummary();

    expect(health.chains.length).toBeGreaterThanOrEqual(3);
    expect(health.chains.map((c) => c.chainId)).toContain('solana');
    expect(health.chains.map((c) => c.chainId)).toContain('ethereum');
    expect(health.chains.map((c) => c.chainId)).toContain('base');
  });
});
