import { type FC, type ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

import '@solana/wallet-adapter-react-ui/styles.css';

// Helius RPC 池 — 分散网络压力
const RPC_POOL = [
  'https://mainnet.helius-rpc.com/?api-key=0642853f-9302-4b06-9c4e-9993bae91683',
  'https://mainnet.helius-rpc.com/?api-key=b57d78a0-3d73-4ae7-91a3-c727e905ac06',
  'https://mainnet.helius-rpc.com/?api-key=1954f0ce-0852-4268-8775-46c7d9f5f696',
  'https://mainnet.helius-rpc.com/?api-key=f6311c8b-13b0-4593-9f64-629bd3c8b5a9',
];

// 页面加载时随机选择一个主节点挂载到 Context（支持钱包插件注入）
const getDynamicEndpoint = () => RPC_POOL[Math.floor(Math.random() * RPC_POOL.length)];
const NETWORK = 'mainnet-beta';

interface Props {
  children: ReactNode;
}

const WalletContextProvider: FC<Props> = ({ children }) => {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet }),
      new BackpackWalletAdapter(),
      new SolanaMobileWalletAdapter({
        appIdentity: {
          name: 'SKR Match',
          uri: typeof window !== 'undefined' ? window.location.origin : 'https://skr-match.app',
          icon: '/favicon.svg',
        },
        addressSelector: createDefaultAddressSelector(),
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        chain: `solana:${NETWORK}`,
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
    ],
    [],
  );

  const endpoint = useMemo(() => getDynamicEndpoint(), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;
