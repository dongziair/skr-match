/**
 * GameBoard.tsx
 * 游戏主面板：堆叠方块、卡槽、道具栏、排行榜/转盘入口
 * 集成：进度存储、.skr 域名、链上 memo、免费道具库存
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  generateBlocks,
  LEVEL_CONFIGS,
  moveToSlot,
  powerUpRemove3,
  powerUpUndo,
  powerUpShuffle,
  checkWin,
  checkLoss,
  SYMBOL_COLORS,
  SYMBOL_LOGOS,
  SYMBOL_ICONS,
} from './GameLogic';
import {
  sendSkrPayment,
  getSkrBalance,
  POWERUP_PRICES,
  SKR_RECEIVER,
} from './TransactionHandler';
import {
  getLocalProgress,
  recordLevelComplete,
  updateLeaderboard,
  syncLeaderboardDisplayName,
  saveProgressOnChain,
  getInventory,
  consumeInventoryItem,
  addToInventory,
  syncPlayerFromServer,
  syncPlayerToServer,
  type SpinReward,
  type PowerUpInventory,
} from './ProgressStore';
import { getDisplayName } from './SkrDomain';
import GameModal from './GameModal';
import type { Block, GameStatus, PowerUpType } from './types';
import {
  RotateCcw,
  Shuffle,
  Trash2,
  Trophy,
  XCircle,
  Loader2,
  ChevronRight,
  Gift,
  Crown,
  RefreshCw,
  Layers,
  AlertTriangle,
  X,
} from 'lucide-react';

// ============ 常量 ============
const SLOT_COUNT = 7;
const BLOCK_GAP = 2;
const MAX_LEVEL = 20;
const BOARD_PADDING = 8; // 面板内边距，大幅收缩让给方块面积
const domainCacheKey = (wallet: string) => `skr_match_domain_${wallet}`;

function getCachedDomain(wallet: string): string {
  try {
    const cached = localStorage.getItem(domainCacheKey(wallet))?.trim() || '';
    return cached.endsWith('.skr') ? cached : '';
  } catch {
    return '';
  }
}

function saveCachedDomain(wallet: string, domain: string): void {
  if (!domain.endsWith('.skr')) return;
  try {
    localStorage.setItem(domainCacheKey(wallet), domain);
    window.dispatchEvent(new CustomEvent('skr_domain_resolved', { detail: { wallet, domain } }));
  } catch {}
}

// ============ Token 图标组件（正方形填充，无边框） ============
function TokenIcon({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = SYMBOL_LOGOS[symbol as keyof typeof SYMBOL_LOGOS];
  const fallback = SYMBOL_ICONS[symbol as keyof typeof SYMBOL_ICONS] || symbol[0];
  const color = SYMBOL_COLORS[symbol as keyof typeof SYMBOL_COLORS] || '#888';

  if (failed || !logoUrl) {
    return (
      <div
        className="rounded-lg flex items-center justify-center font-bold"
        style={{
          width: size,
          height: size,
          background: color,
          color: '#fff',
          fontSize: size * 0.45,
        }}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={symbol}
      className="object-cover"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.18),
        background: 'transparent',
      }}
      onError={() => setFailed(true)}
    />
  );
}

// ============ 主组件 ============
export default function GameBoard() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const domainConnectionRef = useRef(connection);

  // ---- 游戏核心状态 ----
  const [level, setLevel] = useState(1);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [slots, setSlots] = useState<(Block | null)[]>(Array(SLOT_COUNT).fill(null));
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(1);
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  // ---- 钱包 & 用户 ----
  const [skrBalance, setSkrBalance] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [inventory, setInventory] = useState<PowerUpInventory>({ remove3: 0, undo: 0, shuffle: 0 });

  // ---- UI 状态 ----
  const [txLoading, setTxLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [matchAnimation, setMatchAnimation] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<'leaderboard' | 'spin' | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<PowerUpType | null>(null);

  // === 响应式容器宽度与高度 ===
  const [containerWidth, setContainerWidth] = useState(() => Math.min(typeof window !== 'undefined' ? window.innerWidth - 20 : 400, 400));
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardAvailableHeight, setBoardAvailableHeight] = useState(400);
  
  useEffect(() => {
    const handleResize = () => setContainerWidth(Math.min(window.innerWidth - 20, 400));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!boardContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setBoardAvailableHeight(entries[0].contentRect.height);
      }
    });
    observer.observe(boardContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const config = useMemo(() => LEVEL_CONFIGS[level - 1], [level]);
  const walletAddress = publicKey?.toBase58() ?? '';

  useEffect(() => {
    domainConnectionRef.current = connection;
  }, [connection]);

  // ============ 开始游戏 ============
  const startGame = useCallback((lvl: number) => {
    const clampedLvl = Math.max(1, Math.min(lvl, MAX_LEVEL));
    const cfg = LEVEL_CONFIGS[clampedLvl - 1];
    const newBlocks = generateBlocks(cfg);
    setBlocks(newBlocks);
    setSlots(Array(SLOT_COUNT).fill(null));
    setGameStatus('playing');
    setLevel(clampedLvl);
  }, []);

  // ============ 初始化：加载进度 ============
  useEffect(() => {
    if (!walletAddress) return;
    const addr = walletAddress;

    // 加载本地进度 → 继续上次关卡
    const progress = getLocalProgress(addr);
    const startLevel = Math.min(progress.currentLevel, MAX_LEVEL);
    setMaxUnlockedLevel(startLevel);
    startGame(startLevel);

    // 加载道具库存
    setInventory(getInventory(addr));

    // 解析 .skr 域名
    const shortAddr = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    setDisplayName(getCachedDomain(addr) || shortAddr);

    // 从服务器同步玩家数据（合并，不自动跳关）
    syncPlayerFromServer(addr).then(() => {
      // 同步后仅刷新解锁状态和道具，不切换当前关卡
      const synced = getLocalProgress(addr);
      setMaxUnlockedLevel(Math.min(synced.currentLevel, MAX_LEVEL));
      setInventory(getInventory(addr));
    });

    return () => {
      setDisplayName('');
    };
  }, [walletAddress, startGame]);

  // ============ 解析 .skr 域名 ============
  useEffect(() => {
    if (!publicKey || !walletAddress || !signTransaction) return;

    const cached = getCachedDomain(walletAddress);
    if (cached) {
      setDisplayName(cached);
      syncLeaderboardDisplayName(walletAddress, cached);
      void syncPlayerToServer(walletAddress, cached);
      return;
    }

    let cancelled = false;
    getDisplayName(domainConnectionRef.current, publicKey).then((name) => {
      if (cancelled) return;
      console.log('[SKR Match] Display name resolved:', name);
      setDisplayName(name);
      if (name.endsWith('.skr')) {
        saveCachedDomain(walletAddress, name);
        syncLeaderboardDisplayName(walletAddress, name);
        void syncPlayerToServer(walletAddress, name);
      }
    }).catch((err) => {
      if (cancelled) return;
      console.warn('[SKR Match] Display name failed:', err);
      // 保持缩写地址，不覆盖
    });

    return () => {
      cancelled = true;
    };
  }, [publicKey, walletAddress, signTransaction]);

  // ============ 定期从服务器同步（仅刷新道具，不影响当前游戏） ============
  useEffect(() => {
    if (!publicKey) return;
    const addr = publicKey.toBase58();
    const interval = setInterval(async () => {
      await syncPlayerFromServer(addr);
      setInventory(getInventory(addr));
    }, 10_000);
    return () => clearInterval(interval);
  }, [publicKey]);

  // ============ 刷新余额 ============
  useEffect(() => {
    if (!publicKey || !connection) return;
    let mounted = true;
    const refresh = async () => {
      const skrResult = await getSkrBalance(connection, publicKey);
      if (!mounted) return;
      setSkrBalance(skrResult);
    };
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [publicKey, connection]);

  // 初始化（未连接钱包时从第一关开始）
  useEffect(() => {
    if (!publicKey) startGame(1);
  }, [startGame, publicKey]);

  // ============ Toast ============
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ============ 通关处理 ============
  const handleWin = useCallback(() => {
    setGameStatus('won');

    if (!publicKey || !walletAddress) return;

    // 延迟执行非 UI 操作，避免卡顿
    requestAnimationFrame(() => {
      // 记录本地进度
      recordLevelComplete(walletAddress, level);

      // 解锁下一关
      setMaxUnlockedLevel((prev) => Math.max(prev, Math.min(level + 1, MAX_LEVEL)));

      // 更新排行榜
      updateLeaderboard({
        wallet: walletAddress,
        displayName,
        level,
        lastPlayedAt: Date.now(),
      });

      // 同步到服务器
      syncPlayerToServer(walletAddress, displayName);

      // 尝试链上 memo 记录（静默失败，完全不阻塞）
      if (signTransaction) {
        saveProgressOnChain(connection, publicKey, signTransaction, level)
          .then(() => showToast('Progress saved on-chain'))
          .catch(() => { /* 链上记录失败不影响游戏 */ });
      }
    });
  }, [publicKey, walletAddress, signTransaction, connection, level, displayName, showToast]);

  // ============ 点击方块 ============
  const handleBlockClick = useCallback(
    (blockId: string) => {
      if (gameStatus !== 'playing') return;

      const result = moveToSlot(blocks, slots, blockId);
      setBlocks(result.newBlocks);
      setSlots(result.newSlots);

      if (result.matched && result.matchedSymbol) {
        setMatchAnimation(result.matchedSymbol);
        setTimeout(() => setMatchAnimation(null), 600);
      }

      if (checkWin(result.newBlocks)) {
        handleWin();
      } else if (checkLoss(result.newSlots)) {
        setGameStatus('lost');
      }
    },
    [blocks, slots, gameStatus, handleWin],
  );

  // ============ 激活道具效果 ============
  const applyPowerUp = useCallback(
    (type: PowerUpType) => {
      switch (type) {
        case 'remove3': {
          const r = powerUpRemove3(blocks, slots);
          setBlocks(r.newBlocks);
          setSlots(r.newSlots);
          break;
        }
        case 'undo': {
          const r = powerUpUndo(blocks, slots);
          setBlocks(r.newBlocks);
          setSlots(r.newSlots);
          break;
        }
        case 'shuffle': {
          const r = powerUpShuffle(blocks);
          setBlocks(r);
          break;
        }
      }
    },
    [blocks, slots],
  );

  const completePowerUpPurchase = useCallback(
    async (type: PowerUpType) => {
      if (!publicKey || !signTransaction || !walletAddress) return;
      const price = POWERUP_PRICES[type];

      setTxLoading(true);
      try {
        await sendSkrPayment(connection, publicKey, signTransaction, type, level);
        showToast(`Purchased. Spent ${price} $SKR`);

        // 购买的道具入库（不立即使用，显示在库存中）
        addToInventory(walletAddress, type);
        setInventory(getInventory(walletAddress));
        syncPlayerToServer(walletAddress, displayName);

        // 刷新余额
        setSkrBalance(await getSkrBalance(connection, publicKey));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Payment failed';
        showToast(`${msg}`);
      } finally {
        setTxLoading(false);
        setPendingPurchase(null);
      }
    },
    [publicKey, signTransaction, walletAddress, connection, level, displayName, showToast],
  );

  // ============ 使用道具（优先免费库存 → 链上付费） ============
  const handlePowerUp = useCallback(
    async (type: PowerUpType) => {
      if (gameStatus !== 'playing') return;

      // 先检查免费库存
      if (walletAddress && consumeInventoryItem(walletAddress, type)) {
        applyPowerUp(type);
        setInventory(getInventory(walletAddress));
        syncPlayerToServer(walletAddress, displayName);
        showToast('Used free power-up');
        return;
      }

      // 免费库存用完，需要链上付费
      if (!publicKey || !signTransaction) {
        showToast('Guest mode cannot use on-chain items');
        return;
      }

      const price = POWERUP_PRICES[type];
      if (skrBalance < price) {
        showToast(`Insufficient SKR. Need ${price} $SKR`);
        return;
      }

      setPendingPurchase(type);
    },
    [gameStatus, publicKey, signTransaction, skrBalance, walletAddress, applyPowerUp, displayName, showToast],
  );

  // ============ 转盘奖励回调 ============
  const handleSpinReward = useCallback(
    (reward: SpinReward) => {
      if (reward.type !== 'none') {
        setInventory(getInventory(walletAddress));
        showToast(`Got ${reward.label} x1`);
      }
    },
    [walletAddress, showToast],
  );

  // ============ 计算面板尺寸（动态方块大小，统一物理尺寸） ============
  const blockSize = useMemo(() => {
    // 采用游戏后期的全局最大宽高度值作为基准
    // 最大 gridWidth = 6, 最大 gridHeight = 7 (来自 LEVEL_CONFIGS 的上限，强制放大卡牌)
    const MAX_EFFECTIVE_WIDTH = 6 + 0.5;
    const MAX_EFFECTIVE_HEIGHT = 7 + 0.5;
    
    // 基于宽度的最大允许尺寸
    const availableW = containerWidth - BOARD_PADDING * 2;
    const sizeByW = Math.floor((availableW - (MAX_EFFECTIVE_WIDTH - 1) * BLOCK_GAP) / MAX_EFFECTIVE_WIDTH);
    
    // 基于高度的最大允许尺寸
    const availableH = boardAvailableHeight - BOARD_PADDING * 2;
    const sizeByH = Math.floor((availableH - (MAX_EFFECTIVE_HEIGHT - 1) * BLOCK_GAP) / MAX_EFFECTIVE_HEIGHT);

    // 取宽和高允许的最小值，确保最大规模的关卡也能盛下，且最大牌不超过 56px
    return Math.max(20, Math.min(sizeByW, sizeByH, 56));
  }, [containerWidth, boardAvailableHeight]);

  const boardSize = useMemo(() => {
    const step = blockSize + BLOCK_GAP;
    const effectiveW = config.gridWidth + 0.5;
    const effectiveH = config.gridHeight + 0.5;
    const w = effectiveW * step + BOARD_PADDING * 2;
    const h = effectiveH * step + BOARD_PADDING * 2;
    return { width: Math.min(w, containerWidth), height: h };
  }, [config, blockSize, containerWidth]);

  // 动态槽位大小 (避免小屏幕溢出)
  const slotSize = useMemo(() => {
    const gapTotal = 6 * 6; // 6 个间距 (gap-1.5 ≈ 6px)
    const paddingTotal = 24; // 容器内边距 (p-3 = 12px * 2)
    const availableW = containerWidth - paddingTotal - gapTotal;
    const maxSlotW = Math.max(28, Math.floor(availableW / 7));
    const finalW = Math.min(maxSlotW, 46);
    return { width: finalW, height: Math.round(finalW * 54 / 46) };
  }, [containerWidth]);

  // 按层排序
  const sortedBlocks = useMemo(
    () => [...blocks].filter(b => !b.isInSlot).sort((a, b) => a.z - b.z),
    [blocks],
  );

  const remainingBlocks = useMemo(
    () => blocks.filter(b => !b.isInSlot).length,
    [blocks],
  );

  // 难度文字
  const difficultyLabel = useMemo(() => {
    if (level <= 5) return { text: 'Normal', color: '#4ECDC4' };
    if (level <= 10) return { text: 'Hard', color: '#FFD93D' };
    if (level <= 15) return { text: 'Nightmare', color: '#FF9800' };
    return { text: 'Hell', color: '#FF6B6B' };
  }, [level]);

  // ---- 关卡选择 ----
  const handleLevelSelect = useCallback((targetLevel: number) => {
    if (targetLevel > maxUnlockedLevel) return;
    startGame(targetLevel);
    setShowLevelSelect(false);
  }, [maxUnlockedLevel, startGame]);

  return (
    <div className="game-container flex flex-col items-center select-none flex-1 min-h-0 w-full h-full">
      {/* ====== 顶部功能区 (三大入口 + 剩余方块) ====== */}
      <div className="w-full flex-shrink-0 flex flex-col items-center">
        <div className="flex gap-2.5 w-full px-1 mt-2 mb-1.5">
          {/* 关卡选择 */}
          <button
          onClick={() => setShowLevelSelect(!showLevelSelect)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all duration-300 active:scale-95 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(160deg, rgba(0,255,170,0.06) 0%, rgba(0,200,130,0.03) 100%)',
            border: '1.5px solid rgba(0,255,170,0.15)',
            boxShadow: '0 4px 16px rgba(0,255,170,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#00ffaa]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Layers size={22} className="text-[#00ffaa] drop-shadow-[0_0_6px_rgba(0,255,170,0.5)] mb-0.5" />
          <span className="text-[13px] font-black text-[#e0e6f0] tracking-wide">Level</span>
          <div className="flex items-center gap-1">
            <span className="text-[15px] font-black text-[#00ffaa] neon-text">{level}</span>
            <span className="text-[9px] text-[#475569] font-mono">/{MAX_LEVEL}</span>
          </div>
          <span
            className="text-[8px] font-bold px-1.5 py-[1px] rounded-full mt-0.5"
            style={{ color: difficultyLabel.color, background: `${difficultyLabel.color}12`, border: `1px solid ${difficultyLabel.color}25` }}
          >
            {difficultyLabel.text}
          </span>
        </button>

        {/* 每日转 */}
        <button
          onClick={() => setModalTab('spin')}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all duration-300 active:scale-95 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(160deg, rgba(245,158,11,0.06) 0%, rgba(251,191,36,0.03) 100%)',
            border: '1.5px solid rgba(245,158,11,0.15)',
            boxShadow: '0 4px 16px rgba(245,158,11,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#f59e0b]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Gift size={22} className="text-[#f59e0b] drop-shadow-[0_0_6px_rgba(245,158,11,0.5)] mb-0.5" />
          <span className="text-[13px] font-black text-[#e0e6f0] tracking-wide">Daily Bonus</span>
          <span className="text-[10px] font-semibold text-[#f59e0b] tracking-widest">FREE</span>
        </button>

        {/* 排行榜 */}
        <button
          onClick={() => setModalTab('leaderboard')}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all duration-300 active:scale-95 relative overflow-hidden group"
          style={{
            background: 'linear-gradient(160deg, rgba(124,58,237,0.06) 0%, rgba(167,139,250,0.03) 100%)',
            border: '1.5px solid rgba(124,58,237,0.15)',
            boxShadow: '0 4px 16px rgba(124,58,237,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#7c3aed]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <Crown size={22} className="text-[#a78bfa] drop-shadow-[0_0_6px_rgba(167,139,250,0.5)] mb-0.5" />
          <span className="text-[13px] font-black text-[#e0e6f0] tracking-wide">Rank</span>
          <span className="text-[10px] font-semibold text-[#a78bfa] tracking-widest">RANK</span>
        </button>
      </div>

      {/* ====== 剩余方块信息条 ====== */}
      <div className="flex items-center gap-2 w-full px-2 mb-1.5">
        <span className="text-xs text-[#64748b]">Blocks</span>
        <span className="text-[13px] font-black text-[#00ffaa]">{remainingBlocks}</span>
      </div>

      {/* ====== 关卡横向选择条 ====== */}
      {showLevelSelect && (
        <div className="w-full px-1 mb-2 animate-fade-in-up">
          <div className="flex gap-1.5 overflow-x-auto py-2 px-0.5 custom-scroll" style={{ scrollbarWidth: 'thin' }}>
            {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((lvl) => {
              const unlocked = lvl <= maxUnlockedLevel;
              const isCurrent = lvl === level;
              return (
                <button
                  key={lvl}
                  onClick={() => handleLevelSelect(lvl)}
                  disabled={!unlocked}
                  className="flex-shrink-0 flex flex-col items-center justify-center transition-all active:scale-90"
                  style={{
                    width: 44,
                    height: 48,
                    borderRadius: 12,
                    background: isCurrent
                      ? 'linear-gradient(135deg, #00ffaa, #00cc82)'
                      : unlocked
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(255,255,255,0.02)',
                    border: isCurrent
                      ? '1.5px solid #00ffaa'
                      : unlocked
                      ? '1px solid rgba(255,255,255,0.08)'
                      : '1px solid rgba(255,255,255,0.04)',
                    color: isCurrent ? '#0a0e1a' : unlocked ? '#e0e6f0' : '#334155',
                    boxShadow: isCurrent ? '0 0 16px rgba(0,255,170,0.3)' : 'none',
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                  }}
                >
                  {unlocked ? (
                    <>
                      <span className="text-sm font-black leading-none">{lvl}</span>
                      {lvl < maxUnlockedLevel && (
                        <span className="text-[7px] mt-0.5" style={{ color: isCurrent ? '#0a0e1a' : '#00ffaa' }}>✓</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px]">🔒</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      </div>

      {/* ====== 游戏面板弹性区 — 3D Crystal Grid ====== */}
      <div 
        ref={boardContainerRef}
        className="flex-1 w-full min-h-0 relative flex items-center justify-center my-0.5"
      >
        <div
          className="relative rounded-2xl overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,0.4),0_0_30px_rgba(0,255,170,0.03),0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300"
          style={{
            width: boardSize.width,
            height: boardSize.height,
            background: 'linear-gradient(180deg, rgba(10,14,26,0.6) 0%, rgba(15,23,42,0.4) 100%)',
            border: '1px solid rgba(0,255,170,0.06)',
          }}
        >
        {sortedBlocks.map(block => {
          const step = blockSize + BLOCK_GAP;
          const left = BOARD_PADDING + block.x * step;
          const top = BOARD_PADDING + block.y * step;
          const color = SYMBOL_COLORS[block.symbol];
          // 将内部图标放大到水晶框的 85%，使其极其饱满，易于识别与点击
          const iconSize = Math.max(Math.round(blockSize * 0.85), 24);

          return (
            <div
              key={block.id}
              onClick={() => block.isClickable && handleBlockClick(block.id)}
              className={`absolute flex items-center justify-center ${
                block.isClickable
                  ? 'cursor-pointer hover:scale-110 hover:z-50 hover:brightness-125 transition-transform duration-200'
                  : 'transition-none'
              }`}
              style={{
                width: blockSize,
                height: blockSize,
                left,
                top,
                zIndex: block.z * 10 + (block.isClickable ? 5 : 0),
                borderRadius: Math.max(8, Math.round(blockSize * 0.2)),
                background: block.isClickable
                  ? `linear-gradient(145deg, ${color} 0%, ${color}cc 50%, ${color}99 100%)`
                  : 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                opacity: block.isClickable ? 1 : 0.45,
                border: block.isClickable
                  ? '1px solid rgba(255,255,255,0.3)'
                  : '1px solid rgba(255,255,255,0.04)',
                boxShadow: block.isClickable
                  ? `0 4px 12px rgba(0,0,0,0.4), 0 0 8px ${color}30, inset 0 1px 0 rgba(255,255,255,0.15)`
                  : `0 2px 4px rgba(0,0,0,0.5)`,
                transform: `translate3d(0, ${block.z * -2}px, 0)`,
                pointerEvents: block.isClickable ? 'auto' : 'none',
                // 彻底移除 filter: blur 和动态高半径阴影，这是导致大量重绘掉帧的元凶
              }}
            >
              <TokenIcon symbol={block.symbol} size={iconSize} />
            </div>
          );
        })}
        </div>
      </div>

      {/* ====== 底部固定区 ====== */}
      <div className="w-full flex-shrink-0 flex flex-col items-center">
        {/* ====== 消除槽 — Crystal Recessed Dock ====== */}
        <div
          className="flex items-center justify-center gap-1.5 mt-1 p-3 rounded-2xl w-full"
        style={{
          background: 'linear-gradient(180deg, rgba(0,20,40,0.5) 0%, rgba(0,10,25,0.7) 100%)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,255,255,0.06)',
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.4), inset 0 0 24px rgba(0,255,255,0.03), 0 -2px 16px rgba(0,0,0,0.2)',
        }}
      >
        {slots.map((slot, i) => (
          <div
            key={i}
            className={`flex items-center justify-center transition-all duration-300 ${
              matchAnimation && slot?.symbol === matchAnimation ? 'scale-110' : ''
            }`}
            style={{
              width: slotSize.width,
              height: slotSize.height,
              borderRadius: Math.max(8, Math.round(slotSize.width * 0.28)),
              background: slot
                ? `linear-gradient(145deg, ${SYMBOL_COLORS[slot.symbol]} 0%, ${SYMBOL_COLORS[slot.symbol]}bb 100%)`
                : 'rgba(0,20,40,0.5)',
              border: slot
                ? '1.5px solid rgba(255,255,255,0.3)'
                : '1.5px solid rgba(0,255,255,0.06)',
              boxShadow: slot
                ? `0 0 16px ${SYMBOL_COLORS[slot.symbol]}45, inset 0 1px 0 rgba(255,255,255,0.15)`
                : 'inset 0 2px 8px rgba(0,0,0,0.4), inset 0 0 6px rgba(0,255,255,0.02)',
            }}
          >
            {slot && <TokenIcon symbol={slot.symbol} size={28} />}
          </div>
        ))}
        </div>

        {/* ====== 底部操作区 — Large Neon Action Buttons ====== */}
        <div className="flex gap-2 w-full max-w-[360px] mx-auto px-1 pt-4 pb-28">
        <PowerUpButton
          icon={<Trash2 size={20} />}
          label="Remove"
          sublabel="REMOVE"
          cost={POWERUP_PRICES.remove3}
          freeCount={inventory.remove3}
          loading={txLoading}
          onClick={() => handlePowerUp('remove3')}
          neonColor="#ef4444"
        />
        <PowerUpButton
          icon={<RotateCcw size={20} />}
          label="Undo"
          sublabel="UNDO"
          cost={POWERUP_PRICES.undo}
          freeCount={inventory.undo}
          loading={txLoading}
          onClick={() => handlePowerUp('undo')}
          neonColor="#f59e0b"
        />
        <PowerUpButton
          icon={<Shuffle size={20} />}
          label="Shuffle"
          sublabel="SHUFFLE"
          cost={POWERUP_PRICES.shuffle}
          freeCount={inventory.shuffle}
          loading={txLoading}
          onClick={() => handlePowerUp('shuffle')}
          neonColor="#7c3aed"
        />
        {/* 重新开始按钮 (免费) */}
        <button
          onClick={() => startGame(level)}
          className="flex-1 flex flex-col justify-center items-center gap-[2px] py-1.5 rounded-2xl transition-all duration-300 relative overflow-hidden group active:scale-95"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,41,59,0.8))',
            border: '1.5px solid rgba(56,189,248,0.25)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#38bdf8] to-transparent opacity-0 group-hover:opacity-10 transition-opacity"></div>
          <div className="text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] mb-0.5">
            <RefreshCw size={20} strokeWidth={2.5} />
          </div>
          <span className="text-[12px] font-black tracking-wide text-[#e0e6f0]">Restart</span>
          <span className="text-[9px] font-bold text-[#38bdf8] tracking-widest" style={{ letterSpacing: '0.05em' }}>FREE</span>
        </button>
        </div>
      </div>

      {/* ====== Toast ====== */}
      {toast && (
        <div
          className="fixed bottom-28 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm shadow-2xl z-[9999] animate-fade-in-up"
          style={{
            background: 'rgba(10,14,26,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,255,170,0.1)',
            color: '#e0e6f0',
            boxShadow: '0 0 30px rgba(0,0,0,0.5), 0 0 10px rgba(0,255,170,0.05)',
          }}
        >
          {toast}
        </div>
      )}

      {/* ====== 胜利弹窗 ====== */}
      {gameStatus === 'won' && (
        <OverlayModal>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, #00ffaa, #7c3aed)', boxShadow: '0 0 30px rgba(0,255,170,0.3)' }}>
            <Trophy size={32} className="text-[#0a0e1a]" />
          </div>
          <h2 className="text-2xl font-black text-[#e0e6f0] mb-1">🎉 Cleared!</h2>
          <p className="text-[#64748b] mb-5 text-sm">Level {level} completed</p>
          {level < MAX_LEVEL ? (
            <button
              onClick={() => {
                setMaxUnlockedLevel((prev) => Math.max(prev, level + 1));
                startGame(level + 1);
              }}
              className="skr-btn flex items-center gap-1.5 px-8 py-2.5 text-sm"
            >
              Next Level <ChevronRight size={16} />
            </button>
          ) : (
            <div className="text-[#00ffaa] font-bold text-lg neon-text text-center">
              🏆 All Cleared! SKR Master!
            </div>
          )}
        </OverlayModal>
      )}

      {/* ====== 失败弹窗 ====== */}
      {gameStatus === 'lost' && (
        <OverlayModal>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 0 30px rgba(239,68,68,0.3)' }}>
            <XCircle size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-[#e0e6f0] mb-1">💀 Slots Full!</h2>
          <p className="text-[#64748b] mb-5 text-sm">Level {level} failed</p>
          <button
            onClick={() => startGame(level)}
            className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-sm hover:from-red-400 hover:to-red-500 transition shadow-lg shadow-red-500/20"
          >
            Retry
          </button>
        </OverlayModal>
      )}

      {/* ====== 排行榜 + 转盘弹窗 ====== */}
      <GameModal
        visible={modalTab !== null}
        onClose={() => setModalTab(null)}
        wallet={walletAddress}
        initialTab={modalTab ?? 'leaderboard'}
        onSpinReward={handleSpinReward}
      />

      <PurchaseConfirmModal
        item={pendingPurchase}
        loading={txLoading}
        onCancel={() => setPendingPurchase(null)}
        onConfirm={() => {
          if (pendingPurchase) void completePowerUpPurchase(pendingPurchase);
        }}
      />

    </div>
  );
}

const POWERUP_LABELS: Record<PowerUpType, string> = {
  remove3: 'Remove',
  undo: 'Undo',
  shuffle: 'Shuffle',
};

function PurchaseConfirmModal({
  item,
  loading,
  onCancel,
  onConfirm,
}: {
  item: PowerUpType | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!item) return null;

  const price = POWERUP_PRICES[item];
  const receiver = SKR_RECEIVER.toBase58();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}>
      <div
        className="w-full max-w-[360px] rounded-3xl p-5 animate-modal-pop"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,14,26,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[#f59e0b]/10 border border-[#f59e0b]/20">
              <AlertTriangle size={20} className="text-[#f59e0b]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#e0e6f0]">Confirm Purchase</h2>
              <p className="text-xs text-[#64748b] mt-0.5">Wallet approval required</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-2 rounded-xl text-[#475569] hover:text-white hover:bg-white/10 transition disabled:opacity-40"
            title="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        <div className="py-4 space-y-2 text-sm">
          <PurchaseRow label="Item" value={POWERUP_LABELS[item]} />
          <PurchaseRow label="Amount" value={`${price} SKR`} />
          <PurchaseRow label="Network" value="Solana Mainnet" />
          <PurchaseRow label="Receiver" value={`${receiver.slice(0, 6)}...${receiver.slice(-6)}`} mono />
          <div className="mt-4 rounded-2xl p-3 bg-[#f59e0b]/8 border border-[#f59e0b]/20 text-[#fcd34d] text-xs leading-relaxed">
            This is a non-refundable on-chain token transfer for an in-game
            power-up. Check the wallet transaction details before signing.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-4 py-3 bg-white/[0.04] border border-white/[0.08] text-[#e0e6f0] font-bold disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="skr-btn flex items-center justify-center gap-2 px-4 py-3 disabled:opacity-40"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 bg-white/[0.03] border border-white/[0.06]">
      <span className="text-[#64748b]">{label}</span>
      <span className={`text-[#e0e6f0] font-bold text-right truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ============ 道具按钮 — Large Neon Crystal ============
function PowerUpButton({
  icon,
  label,
  sublabel,
  cost,
  freeCount,
  loading,
  onClick,
  neonColor,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  cost: number;
  freeCount: number;
  loading: boolean;
  onClick: () => void;
  neonColor: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl transition-all active:scale-[0.96] disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: `linear-gradient(180deg, ${neonColor}12 0%, ${neonColor}06 100%)`,
        border: `1px solid ${neonColor}20`,
        boxShadow: `0 0 20px ${neonColor}08, inset 0 1px 0 rgba(255,255,255,0.04)`,
        minHeight: 82,
      }}
    >
      {loading ? (
        <Loader2 size={22} className="animate-spin text-[#475569]" />
      ) : (
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-0.5"
          style={{
            background: `radial-gradient(circle, ${neonColor}30 0%, transparent 70%)`,
            boxShadow: `0 0 20px ${neonColor}20`,
            color: neonColor,
          }}
        >
          {icon}
        </span>
      )}
      <span className="text-[11px] font-bold text-[#e0e6f0]">{label}</span>
      <span className="text-[7px] text-[#475569] tracking-widest uppercase">{sublabel}</span>
      {freeCount > 0 ? (
        <span className="text-[9px] text-[#00ffaa] font-bold mt-0.5">Free ×{freeCount}</span>
      ) : (
        <span className="text-[9px] text-[#f59e0b] font-medium mt-0.5">{cost} $SKR</span>
      )}
    </button>
  );
}

// ============ 弹窗覆盖层 (毛玻璃) ============
function OverlayModal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div
        className="flex flex-col items-center p-8 rounded-3xl max-w-xs w-full mx-4 animate-modal-pop"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(10,14,26,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 40px rgba(0,255,170,0.05)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
