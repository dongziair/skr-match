import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react';
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet, X, Loader2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

const sessionWalletKey = 'skr_match_wallet_session';

const SkrGate: FC<Props> = ({ children }) => {
  const { connected, publicKey, wallets, wallet, select, connect, connecting } = useWallet();
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [hasSessionWallet, setHasSessionWallet] = useState(() => {
    try {
      return sessionStorage.getItem(sessionWalletKey) === '1';
    } catch {
      return false;
    }
  });
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return sessionStorage.getItem('skr_match_guest') === '1';
    } catch {
      return false;
    }
  });
  const [reconnectAttempted, setReconnectAttempted] = useState(false);

  const availableWallets = useMemo(
    () => wallets
      .filter(({ readyState }) => readyState !== WalletReadyState.Unsupported)
      .sort((a, b) => {
        const aInstalled = a.readyState === WalletReadyState.Installed ? 0 : 1;
        const bInstalled = b.readyState === WalletReadyState.Installed ? 0 : 1;
        return aInstalled - bInstalled;
      }),
    [wallets],
  );

  useEffect(() => {
    if (!pendingWalletName || wallet?.adapter.name !== pendingWalletName) return;

    let cancelled = false;
    (async () => {
      try {
        setConnectError(null);
        await connect();
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Wallet connect failed';
          setConnectError(message);
        }
      } finally {
        if (!cancelled) setPendingWalletName(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wallet, pendingWalletName, connect]);

  useEffect(() => {
    if (!connected && !publicKey) return;

    setHasSessionWallet(true);
    setShowWalletPicker(false);
    setConnectError(null);
    setReconnectAttempted(false);

    try {
      sessionStorage.setItem(sessionWalletKey, '1');
    } catch {}
  }, [connected, publicKey]);

  useEffect(() => {
    if (!hasSessionWallet || connected || publicKey || connecting || reconnectAttempted) return;
    if (!wallet) return;

    let cancelled = false;
    setReconnectAttempted(true);

    (async () => {
      try {
        await connect();
      } catch {
        if (!cancelled) {
          // 静默重连失败时不拦截页面，保持当前会话继续可见
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasSessionWallet, connected, publicKey, connecting, reconnectAttempted, wallet, connect]);

  const handleWalletSelect = (walletName: string) => {
    setConnectError(null);
    setPendingWalletName(walletName);
    select(walletName as WalletName);
  };

  const handleGuestLogin = () => {
    try {
      sessionStorage.setItem('skr_match_guest', '1');
    } catch {}
    setIsGuest(true);
  };

  if (connected || publicKey || hasSessionWallet || isGuest) {
    return <>{children}</>;
  }

  return (
    <div className="w-full min-h-[100dvh] bg-[#0a0e1a] flex flex-col items-center justify-center cyber-grid-bg overflow-hidden">
      <div className="flex flex-col items-center max-w-[420px] w-full px-6 animate-fade-in-up">
        <div className="mb-8 animate-float">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #00ffaa, #7c3aed)',
              boxShadow: '0 0 40px rgba(0,255,170,0.3), 0 0 80px rgba(124,58,237,0.15)',
            }}
          >
            <span className="text-3xl font-black text-[#0a0e1a]">SKR</span>
          </div>
        </div>

        <h1 className="text-3xl font-black mb-1 tracking-tight text-center">
          <span className="text-[#00ffaa] neon-text">SKR</span>{' '}
          <span className="text-[#e0e6f0]">Match</span>
        </h1>
        <p className="text-[#64748b] text-sm mb-8 text-center">
          Connect your Solana wallet to start playing
        </p>

        <button
          onClick={() => setShowWalletPicker(true)}
          className="skr-btn flex items-center justify-center gap-2 text-base px-8 py-3.5 w-full max-w-[280px] mb-4"
        >
          <Wallet size={18} />
          Connect Wallet
        </button>

        <button
          onClick={handleGuestLogin}
          className="skr-btn-outline flex items-center justify-center gap-2 text-sm px-8 py-3 w-full max-w-[280px]"
          style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#94a3b8' }}
        >
          Play as Guest
        </button>

        <p className="text-[#334155] text-xs mt-8">Powered by Solana</p>
      </div>

      {showWalletPicker && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowWalletPicker(false)}
          />
          <div
            className="relative w-full max-w-[380px] rounded-3xl p-4 animate-modal-pop"
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,14,26,0.99) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,170,0.05)',
            }}
          >
            <div className="flex items-center justify-between px-1 pb-3 border-b border-white/5">
              <div>
                <p className="text-base font-bold text-[#e0e6f0]">Select Wallet</p>
                <p className="text-xs text-[#64748b] mt-1">Choose a Solana wallet to continue</p>
              </div>
              <button
                onClick={() => setShowWalletPicker(false)}
                className="p-2 rounded-xl text-[#475569] hover:text-white hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {availableWallets.map(({ adapter, readyState }) => {
                const disabled = readyState === WalletReadyState.NotDetected || connecting;
                const isPending = pendingWalletName === adapter.name;

                return (
                  <button
                    key={adapter.name}
                    onClick={() => handleWalletSelect(adapter.name)}
                    disabled={disabled}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition"
                    style={{
                      background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      opacity: disabled ? 0.45 : 1,
                    }}
                  >
                    <img
                      src={adapter.icon}
                      alt={adapter.name}
                      className="w-10 h-10 rounded-xl object-cover bg-white"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#e0e6f0] truncate">{adapter.name}</p>
                      <p className="text-[11px] text-[#64748b]">
                        {readyState === WalletReadyState.Installed
                          ? 'Installed'
                          : readyState === WalletReadyState.Loadable
                          ? 'Available'
                          : 'Not detected'}
                      </p>
                    </div>
                    {isPending && <Loader2 size={16} className="text-[#00ffaa] animate-spin" />}
                  </button>
                );
              })}
            </div>

            {connectError && (
              <p className="text-xs text-red-400 mt-3 px-1">{connectError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkrGate;
