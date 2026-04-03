/**
 * GameModal.tsx
 * 两个独立底部弹窗：排行榜 / 幸运转盘
 */

import { useState, useEffect } from 'react';
import { X, Crown, Gift, Loader2 } from 'lucide-react';
import {
  getLeaderboard,
  fetchServerLeaderboard,
  doSpin,
  canSpin,
  SPIN_REWARDS,
  type SpinReward,
  type LeaderboardEntry,
} from './ProgressStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  wallet: string;
  initialTab: 'leaderboard' | 'spin';
  onSpinReward: (reward: SpinReward) => void;
}

export default function GameModal({ visible, onClose, wallet, initialTab, onSpinReward }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinReward | null>(null);
  const [spinAngle, setSpinAngle] = useState(0);
  const [spinStatus, setSpinStatus] = useState(canSpin(wallet));

  useEffect(() => {
    if (!visible) return;
    
    // 打开时立即更新一次
    setSpinStatus(canSpin(wallet));
    
    // 每秒走字更新
    const timer = setInterval(() => {
      setSpinStatus(canSpin(wallet));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [visible, wallet, spinResult]);

  // 每次弹窗打开时重置转盘结果
  useEffect(() => {
    if (visible) setSpinResult(null);
  }, [visible]);

  // 排行榜：优先从服务器获取，fallback 到 localStorage
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(getLeaderboard());

  useEffect(() => {
    if (!visible || initialTab !== 'leaderboard') return;
    fetchServerLeaderboard().then(data => {
      if (data.length > 0) setLeaderboard(data);
      else setLeaderboard(getLeaderboard());
    });
  }, [visible, initialTab]);

  const handleSpin = () => {
    if (spinning || !spinStatus.allowed) return;
    setSpinning(true);
    setSpinResult(null);

    const sectorAngle = 360 / SPIN_REWARDS.length;
    const extraSpins = Math.floor(Math.random() * 3 + 5) * 360;
    const targetIndex = Math.floor(Math.random() * SPIN_REWARDS.length);

    // 在目标扇区内随机偏移，以保证指针停在扇区内部而不是边界线上
    const margin = sectorAngle * 0.15;
    const randomOffset = margin + Math.random() * (sectorAngle - 2 * margin);
    
    // SVG 初始时 0 号扇区在最顶端。要让 targetIndex 号扇区到达顶部
    // 需要将转盘旋转 360 - (其起始角度 + 随机偏移)
    const finalRotation = 360 - (targetIndex * sectorAngle + randomOffset);
    
    setSpinAngle(prev => prev + extraSpins + finalRotation);

    setTimeout(() => {
      const reward = doSpin(wallet, targetIndex);
      setSpinResult(reward);
      setSpinning(false);
      onSpinReward(reward);
      setSpinStatus(canSpin(wallet));
    }, 3500);
  };

  const formatCooldown = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  if (!visible) return null;

  const isLeaderboard = initialTab === 'leaderboard';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* 居中面板 */}
      <div
        className="relative w-full max-w-[380px] rounded-3xl animate-modal-pop"
        style={{
          maxHeight: '80vh',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.97) 0%, rgba(10,14,26,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,170,0.04)',
        }}
      >
        {/* 拖拽条 */}
        <div className="flex justify-center pt-4 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/10" />
        </div>

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            {isLeaderboard ? (
              <>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
                >
                  <Crown size={16} className="text-white" />
                </div>
                <span className="text-base font-bold text-[#e0e6f0]">Leaderboard</span>
              </>
            ) : (
              <>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #00ffaa, #00cc82)', boxShadow: '0 0 12px rgba(0,255,170,0.3)' }}
                >
                  <Gift size={16} className="text-[#0a0e1a]" />
                </div>
                <span className="text-base font-bold text-[#e0e6f0]">Daily Spin</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#475569] hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* ===== 排行榜内容 ===== */}
        {isLeaderboard && (
          <div className="overflow-y-auto custom-scroll" style={{ maxHeight: 'calc(80vh - 84px)' }}>
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#475569]">
                <Crown size={36} className="mb-3 opacity-30" />
                <p className="text-sm text-[#64748b]">No ranking data</p>
                <p className="text-xs mt-1 text-[#475569]">Clear levels to rank up!</p>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {leaderboard.map((entry, i) => {
                  const rankColors = [
                    { bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.2)', glow: 'rgba(255,215,0,0.1)' },
                    { bg: 'rgba(192,192,192,0.06)', border: 'rgba(192,192,192,0.15)', glow: 'rgba(192,192,192,0.05)' },
                    { bg: 'rgba(205,127,50,0.06)', border: 'rgba(205,127,50,0.15)', glow: 'rgba(205,127,50,0.05)' },
                  ];
                  const rc = i < 3 ? rankColors[i] : { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.05)', glow: 'transparent' };

                  return (
                    <div
                      key={entry.wallet}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: rc.bg, border: `1px solid ${rc.border}`, boxShadow: `0 0 12px ${rc.glow}` }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{
                          background: i === 0 ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                            : i === 1 ? 'linear-gradient(135deg, #C0C0C0, #A0A0A0)'
                            : i === 2 ? 'linear-gradient(135deg, #CD7F32, #B8690F)'
                            : 'rgba(255,255,255,0.06)',
                          color: i < 3 ? '#0a0e1a' : '#64748b',
                        }}
                      >
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center">
                        <p className="text-sm font-semibold text-[#e0e6f0] truncate">{entry.displayName}</p>
                      </div>
                      <p className="text-base font-black text-[#00ffaa] neon-text flex-shrink-0">Lv.{entry.level}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== 转盘内容 ===== */}
        {!isLeaderboard && (
          <div className="flex flex-col items-center px-4 py-4 gap-5">
            {/* 转盘 */}
            <div className="relative" style={{ width: 220, height: 220 }}>
              {/* 外圈光环 */}
              <div
                className="absolute inset-[-8px] rounded-full"
                style={{ background: 'conic-gradient(from 0deg, #00ffaa, #7c3aed, #00ffaa)', opacity: 0.2, filter: 'blur(4px)' }}
              />
              <div className="absolute inset-[-4px] rounded-full" style={{ background: '#0a0e1a' }} />

              {/* 指针 */}
              <div className="absolute top-[-12px] left-1/2 -translate-x-1/2 z-10">
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '20px solid #00ffaa',
                  filter: 'drop-shadow(0 0 6px rgba(0,255,170,0.5))',
                }} />
              </div>

              {/* 转盘本体 */}
              <svg
                width="220" height="220" viewBox="0 0 200 200"
                className="relative"
                style={{
                  transform: `rotate(${spinAngle}deg)`,
                  transition: spinning ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  borderRadius: '50%',
                }}
              >
                {SPIN_REWARDS.map((reward, i) => {
                  const total = SPIN_REWARDS.length;
                  const angle = (360 / total) * i;
                  const endAngle = angle + 360 / total;
                  const toRad = (a: number) => (a * Math.PI) / 180;
                  const x1 = 100 + 98 * Math.cos(toRad(angle - 90));
                  const y1 = 100 + 98 * Math.sin(toRad(angle - 90));
                  const x2 = 100 + 98 * Math.cos(toRad(endAngle - 90));
                  const y2 = 100 + 98 * Math.sin(toRad(endAngle - 90));
                  const palette = ['#00ffaa', '#7c3aed', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6'];
                  const fill = palette[i % palette.length];
                  const midAngle = angle + 360 / total / 2 - 90;
                  const textR = 65;
                  const tx = 100 + textR * Math.cos(toRad(midAngle));
                  const ty = 100 + textR * Math.sin(toRad(midAngle));

                  return (
                    <g key={i}>
                      <path
                        d={`M 100 100 L ${x1} ${y1} A 98 98 0 0 1 ${x2} ${y2} Z`}
                        fill={`${fill}30`}
                        stroke={`${fill}60`}
                        strokeWidth="1"
                      />
                      <text
                        x={tx} y={ty}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#e0e6f0"
                        fontSize="10"
                        fontWeight="bold"
                        transform={`rotate(${angle + 360 / total / 2}, ${tx}, ${ty})`}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {reward.label}
                      </text>
                    </g>
                  );
                })}
                <circle cx="100" cy="100" r="20" fill="#0f172a" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fontSize="16">🎰</text>
              </svg>
            </div>

            {/* 结果 */}
            {spinResult && (
              <div
                className="text-center animate-fade-in-up px-4 py-3 rounded-xl w-full"
                style={{ background: 'rgba(0,255,170,0.06)', border: '1px solid rgba(0,255,170,0.15)' }}
              >
                <p className="text-base font-bold text-[#e0e6f0]">
                  {spinResult.type === 'none'
                    ? '😅 Better luck next time!'
                    : <span>🎉 Got <span className="text-[#00ffaa] neon-text">{spinResult.label}</span> !</span>
                  }
                </p>
                {spinResult.type !== 'none' && (
                  <p className="text-xs text-[#00ffaa]/60 mt-0.5">Added to inventory</p>
                )}
              </div>
            )}

            {/* 按钮 */}
            <button
              onClick={handleSpin}
              disabled={spinning || !spinStatus.allowed}
              className="skr-btn flex items-center gap-2 px-8 py-3 w-full justify-center disabled:opacity-40"
            >
              {spinning ? (
                <><Loader2 size={18} className="animate-spin" /> Spinning...</>
              ) : spinStatus.allowed ? (
                <><Gift size={18} /> Free Spin</>
              ) : (
                `${formatCooldown(spinStatus.remainingMs)} cooldown`
              )}
            </button>

            <p className="text-[10px] text-[#334155] text-center">
              1 free spin every 24h · Win power-ups
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
