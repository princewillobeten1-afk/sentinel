# 03 — Multi-Chain Wallet Provider Abstraction

## 1. Abstraction Design

The platform abstracts wallet interaction across blockchain ecosystems through a unified `WalletProvider` interface. The UI interacts solely with this abstraction and never binds directly to a single vendor.

```text
               WalletProvider Interface
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
SolanaWalletAdapter               EvmWalletAdapter
(Phantom, Solflare, Backpack)     (MetaMask, Coinbase, WalletConnect)
```

## 2. Connection Lifecycle States

```text
DISCONNECTED ──(connect)──> CONNECTING ──(success)──> CONNECTED
     ▲                          │                         │
     │                          └──(error)──> ERROR       └──(wrong chain)──> WRONG_NETWORK
     │                                                                             │
     └────────────────────────(disconnect)────────────────────────────────────────┘
```

## 3. Core Interface Contract

```typescript
export interface WalletProvider {
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'WRONG_NETWORK' | 'DISCONNECTING' | 'ERROR';
  address: string | null;
  chainId: string | null;
  connect(chainId?: string): Promise<void>;
  disconnect(): Promise<void>;
  getBalance(tokenAddress: string): Promise<number>;
  signTransaction(preparedPayload: any): Promise<string>;
}
```
