/**
 * SpinWheel.tsx
 * 每日转盘组件：玩家每天可以转一次转盘获取免费道具
 */

import { useState, useRef, useCallback } from 'react';
import { X, Gift } from 'lucide-react';
import { SPIN_REWARDS, canSpinToday, markSpinUsed, addToInventory, type SpinReward } from './ProgressStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  wallet: string;
  onReward: (reward: SpinReward) => void;
}

const SEGMENT_COUNT = SPIN_REWARDS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

export default function SpinWheel({ visible, onClose, wallet, onReward }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinReward | null>(null);
  const canSpin = canSpinToday(wallet);
  const wheelRef = useRef<HTMLDivElement>(null);

  const handleSpin = useCallback(() => {
    if (spinning || !canSpin) return;

    setSpinning(true);
    setResult(null);

    // 随机选中奖品
    const winIndex = Math.floor(Math.random() * SEGMENT_COUNT);
    // 在目标扇区内随机取一个偏移角度（留 15% 边距避免落在分界线上）
    const margin = SEGMENT_ANGLE * 0.15;
    const randomOffset = margin + Math.random() * (SEGMENT_ANGLE - 2 * margin);
    const extraRotation = 5 * 360 + (360 - winIndex * SEGMENT_ANGLE - randomOffset);
    const newRotation = rotation + extraRotation;
    setRotation(newRotation);

    // 转盘动画结束后（4秒）
    setTimeout(() => {
      const reward = SPIN_REWARDS[winIndex];
      setResult(reward);
      setSpinning(false);
      markSpinUsed(wallet);

      if (reward.type !== 'none' && reward.type !== 'sol') {
        addToInventory(wallet, reward.type, 1);
      }

      onReward(reward);
    }, 4000);
  }, [spinning, canSpin, rotation, wallet, onReward]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col items-center w-full sm:max-w-md mx-0 sm:mx-4 p-6 pb-8 rounded-t-2xl sm:rounded-2xl bg-white border border-[#e0e0e0] shadow-xl animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-5">
          <div className="flex items-center gap-2.5">
            <Gift size={24} className="text-[#00cc82]" />
            <h2 className="text-xl font-bold text-[#1a1a2e]">每日转盘</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-[#999] hover:text-[#333] hover:bg-[#f0f2f5] transition active:bg-[#e5e5e5]"
          >
            <X size={22} />
          </button>
        </div>

        {/* 转盘 — 更大的尺寸适配手机 */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 mb-5">
          {/* 指针 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div
              className="w-0 h-0"
              style={{
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: '24px solid #00cc82',
              }}
            />
          </div>

          {/* 转盘主体 */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full border-4 border-[#00cc82]/30 overflow-hidden"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.23, 1, 0.32, 1)' : 'none',
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {SPIN_REWARDS.map((reward, i) => {
                const startAngle = i * SEGMENT_ANGLE;
                const endAngle = (i + 1) * SEGMENT_ANGLE;
                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (endAngle - 90) * (Math.PI / 180);
                const x1 = 100 + 100 * Math.cos(startRad);
                const y1 = 100 + 100 * Math.sin(startRad);
                const x2 = 100 + 100 * Math.cos(endRad);
                const y2 = 100 + 100 * Math.sin(endRad);
                const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;

                // 文字位置（扇区中间方向，半径 60%）
                const midRad = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
                const tx = 100 + 60 * Math.cos(midRad);
                const ty = 100 + 60 * Math.sin(midRad);
                const textAngle = (startAngle + endAngle) / 2;

                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={`${reward.color}33`}
                      stroke={reward.color}
                      strokeWidth="0.5"
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill={reward.color}
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${textAngle}, ${tx}, ${ty})`}
                    >
                      {reward.label}
                    </text>
                  </g>
                );
              })}
              {/* 中心圆 */}
              <circle cx="100" cy="100" r="15" fill="white" stroke="#00cc82" strokeWidth="2" />
              <text x="100" y="102" fill="#00cc82" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                SKR
              </text>
            </svg>
          </div>
        </div>

        {/* 结果显示 */}
        {result && (
          <div className="mb-4 text-center animate-fade-in-up">
            {result.type === 'none' ? (
              <p className="text-[#999] text-base">😕 谢谢参与，明天再来！</p>
            ) : (
              <p className="text-base">
                🎉 获得 <span className="font-bold" style={{ color: result.color }}>{result.label}</span> ×1！
              </p>
            )}
          </div>
        )}

        {/* 转盘按钮 — 更大的触摸区域 */}
        <button
          onClick={handleSpin}
          disabled={spinning || !canSpin}
          className="skr-btn w-full px-8 py-4 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {spinning ? '转动中...' : !canSpin ? '今日已转' : '开始转盘 🎰'}
        </button>

        {!canSpin && !spinning && !result && (
          <p className="text-sm text-[#999] mt-3">每天可免费转一次，明天再来吧！</p>
        )}
      </div>
    </div>
  );
}
