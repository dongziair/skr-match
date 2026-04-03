import { useWallet } from '@solana/wallet-adapter-react';
import { Gamepad2, LogOut, Copy, Check, Hexagon, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import BgMusic from './BgMusic';

export default function Navbar() {
  const { publicKey, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [domainName, setDomainName] = useState<string | null>(null);

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  // 获取和监听域名
  useEffect(() => {
    if (!publicKey) {
      setDomainName(null);
      return;
    }
    const walletStr = publicKey.toBase58();
    const cacheKey = `skr_match_domain_${walletStr}`;
    
    // 初始化读取
    const cached = localStorage.getItem(cacheKey);
    if (cached && cached.endsWith('.skr')) {
      setDomainName(cached);
    }

    // 监听 GameBoard 中发出的自定义事件
    const handleDomainResolved = (e: any) => {
      if (e.detail?.wallet === walletStr && e.detail?.domain) {
        setDomainName(e.detail.domain);
      }
    };
    
    window.addEventListener('skr_domain_resolved', handleDomainResolved);
    return () => window.removeEventListener('skr_domain_resolved', handleDomainResolved);
  }, [publicKey]);

  const handleCopy = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(domainName || publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayAddress = domainName || (publicKey ? shortenAddress(publicKey.toBase58()) : '');

  const handleDisconnect = async () => {
    sessionStorage.removeItem('skr_match_wallet_session');
    try {
      await disconnect();
    } catch (e) {
      console.warn('Disconnect error:', e);
    }
    // 断开后因为状态众多，最稳妥方式为重载页面打回网关，解决残影和残留 bug
    window.location.reload();
  };

  return (
    <nav className="relative flex items-center justify-between w-full px-2 py-2.5 bg-[#0a0e1a]/80 backdrop-blur-md border-b border-[#00ffaa]/20 z-50 shadow-[0_4px_20px_rgba(0,255,170,0.1)] gap-2">
      {/* 顶部高光条 */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00ffaa]/50 to-transparent"></div>
      
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="relative w-8 h-8 flex items-center justify-center bg-transparent border border-[#00ffaa]/50 rounded-lg overflow-hidden group shadow-[0_0_10px_rgba(0,255,170,0.2)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00ffaa]/20 to-transparent group-hover:from-[#00ffaa]/40 transition-colors"></div>
          <Gamepad2 size={16} className="text-[#00ffaa] drop-shadow-[0_0_5px_#00ffaa]" />
        </div>
        <h1 className="text-lg font-black italic tracking-wider flex items-center pr-1 border-r border-white/10">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ffaa] to-[#00b8ff] drop-shadow-[0_0_8px_rgba(0,255,170,0.6)]">SKR</span>
          <span className="text-[#e2e8f0] ml-1 uppercase text-[11px] tracking-widest font-semibold drop-shadow-md">Match</span>
        </h1>
        
        {/* 音量控制按钮 */}
        <div className="flex items-center -ml-1">
          <BgMusic />
        </div>
      </div>

      {publicKey ? (
        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-1">
          <button
            onClick={handleCopy}
            className="group relative flex items-center gap-1.5 bg-[#0f172a]/80 border border-[#00ffaa]/30 hover:border-[#00ffaa] px-2 py-1.5 rounded-md transition-all duration-300 active:scale-95 overflow-hidden min-w-0"
            title="Copy address or domain"
          >
            {/* 扫光动画 */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            
            {domainName ? (
              <span className="flex items-center gap-1 font-bold text-[#00ffaa] drop-shadow-[0_0_5px_rgba(0,255,170,0.5)] truncate max-w-[90px] text-xs">
                <Hexagon size={12} className="fill-[#00ffaa]/20 flex-shrink-0" />
                <span className="truncate">{displayAddress}</span>
              </span>
            ) : (
              <span className="font-mono text-xs text-[#94a3b8] group-hover:text-white transition-colors truncate max-w-[90px]">
                {displayAddress}
              </span>
            )}
            
            <div className="w-[1px] h-3 bg-white/10 mx-0.5 flex-shrink-0"></div>
            
            {copied ? (
              <Check size={12} className="text-[#00ffaa] flex-shrink-0" />
            ) : (
              <Copy size={12} className="text-[#475569] group-hover:text-[#00ffaa] transition-colors flex-shrink-0" />
            )}
          </button>
          
          <button
            onClick={handleDisconnect}
            className="p-1.5 rounded-md bg-[#0f172a]/80 border border-red-500/30 text-[#ef4444] hover:bg-red-500/20 hover:border-red-500 hover:text-red-400 transition-all duration-300 flex-shrink-0 shadow-[0_0_10px_rgba(239,68,68,0)] hover:shadow-[0_0_10px_rgba(239,68,68,0.3)]"
            title="Disconnect"
          >
            <LogOut size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 whitespace-nowrap">
            Guest
          </span>
          <button
            onClick={() => {
              sessionStorage.removeItem('skr_match_guest');
              window.location.reload();
            }}
            className="text-[11px] px-2 py-1 rounded bg-[#0f172a]/80 border border-white/10 font-bold text-[#e0e6f0] hover:text-[#00ffaa] transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <Wallet size={12} /> Connect
          </button>
        </div>
      )}
    </nav>
  );
}
