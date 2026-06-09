import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from '@solana-mobile/wallet-standard-mobile';

registerMwa({
  appIdentity: {
    name: 'SKR Match',
    uri: typeof window !== 'undefined' ? window.location.origin : 'https://skr-match.app',
    icon: '/favicon.svg',
  },
  authorizationCache: createDefaultAuthorizationCache(),
  chains: ['solana:mainnet'],
  chainSelector: createDefaultChainSelector(),
  onWalletNotFound: createDefaultWalletNotFoundHandler(),
});
