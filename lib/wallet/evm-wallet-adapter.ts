import { IWalletAdapter } from './wallet-provider';
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_ID_HEX,
  ROBINHOOD_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID_HEX,
  CHAIN_CONFIGS,
  isEvmAddress,
} from '@/lib/chains/chain-config';

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isOKExWallet?: boolean;
}

export const ROBINHOOD_MAINNET_CHAIN_PARAMS = {
  chainId: ROBINHOOD_CHAIN_ID_HEX,
  chainName: CHAIN_CONFIGS.robinhood.chainName,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [CHAIN_CONFIGS.robinhood.rpcUrl],
  blockExplorerUrls: [CHAIN_CONFIGS.robinhood.explorerUrl],
};

export const ROBINHOOD_TESTNET_CHAIN_PARAMS = {
  chainId: ROBINHOOD_TESTNET_CHAIN_ID_HEX,
  chainName: 'Robinhood Chain Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [CHAIN_CONFIGS.robinhood.testnetRpcUrl ?? 'https://rpc.testnet.chain.robinhood.com'],
  blockExplorerUrls: [
    CHAIN_CONFIGS.robinhood.testnetExplorerUrl ?? 'https://explorer.testnet.chain.robinhood.com',
  ],
};

export function getInjectedEvmProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { ethereum?: Eip1193Provider };
  return win.ethereum && typeof win.ethereum.request === 'function' ? win.ethereum : null;
}

export function parseEvmChainId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = trimmed.startsWith('0x') ? parseInt(trimmed, 16) : parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function switchOrAddRobinhoodChain(
  provider: Eip1193Provider,
  targetChainId: number = ROBINHOOD_CHAIN_ID,
): Promise<boolean> {
  const params =
    targetChainId === ROBINHOOD_TESTNET_CHAIN_ID
      ? ROBINHOOD_TESTNET_CHAIN_PARAMS
      : ROBINHOOD_MAINNET_CHAIN_PARAMS;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: params.chainId }],
    });
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [params],
      });
      return true;
    }
    throw err;
  }
}

export class EvmWalletAdapterImpl implements IWalletAdapter {
  readonly chainFamily = 'evm' as const;
  readonly chainId: string;
  private connectedAddress: string | null = null;

  constructor(chainId = ROBINHOOD_CHAIN_ID_HEX) {
    this.chainId = chainId;
  }

  async connect(): Promise<{ address: string; chainId: string }> {
    const provider = getInjectedEvmProvider();
    if (!provider) {
      throw new Error('No EVM wallet extension detected. Install MetaMask, Rabby, or Coinbase Wallet.');
    }

    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
    const address = accounts?.[0];
    if (!address || !isEvmAddress(address)) {
      throw new Error('No valid EVM account returned from wallet.');
    }

    const rawChainId = await provider.request({ method: 'eth_chainId' });
    this.connectedAddress = address;

    return {
      address,
      chainId: typeof rawChainId === 'string' ? rawChainId : this.chainId,
    };
  }

  async disconnect(): Promise<void> {
    this.connectedAddress = null;
  }

  async getBalance(tokenAddress: string, walletAddress: string): Promise<number> {
    const target = walletAddress || this.connectedAddress;
    if (!target || !isEvmAddress(target)) return 0;

    const query = new URLSearchParams({ chain: 'robinhood', address: target });
    if (tokenAddress && isEvmAddress(tokenAddress)) {
      query.set('token', tokenAddress);
    }
    const res = await fetch(`/api/v1/wallet/balance?${query.toString()}`, { cache: 'no-store' });
    if (!res.ok) return 0;
    const json = (await res.json()) as { balanceEth?: number; balanceSol?: number };
    return typeof json.balanceEth === 'number'
      ? json.balanceEth
      : typeof json.balanceSol === 'number'
        ? json.balanceSol
        : 0;
  }

  async signMessage(message: string, address?: string): Promise<string> {
    const provider = getInjectedEvmProvider();
    if (!provider) throw new Error('No EVM wallet extension detected.');
    const signer = address || this.connectedAddress;
    if (!signer) throw new Error('EVM wallet is not connected.');
    const sig = await provider.request({
      method: 'personal_sign',
      params: [message, signer],
    });
    return String(sig);
  }

  async signTransaction(rawPayload: Record<string, unknown>): Promise<string> {
    const provider = getInjectedEvmProvider();
    if (!provider) throw new Error('No EVM wallet extension detected.');
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [rawPayload],
    });
    return String(txHash);
  }
}
