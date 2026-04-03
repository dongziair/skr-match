/**
 * Leaderboard.tsx
 * 排行榜组件：显示玩家最高关卡排名
 */

import { useState, useEffect } from 'react';
import { Trophy, Medal, X } from 'lucide-react';
import { getLeaderboard, type LeaderboardEntry } from './ProgressStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function Leaderboard({ visible, onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (visible) {
      setEntries(getLeaderboard());
    }
  }, [visible]);

  if (!visible) return null;

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy size={20} className="text-amber-400" />;
    if (rank === 1) return <Medal size={20} className="text-gray-400" />;
    if (rank === 2) return <Medal size={20} className="text-amber-600" />;
    return <span className="text-sm text-[#999] w-5 text-center font-medium">{rank + 1}</span>;
  };

  const getLevelBadge = (level: number) => {
    if (level >= 20) return { text: 'MAX', color: '#FF6B6B' };
    if (level >= 15) return { text: `Lv${level}`, color: '#E040FB' };
    if (level >= 10) return { text: `Lv${level}`, color: '#FFD700' };
    if (level >= 5) return { text: `Lv${level}`, color: '#4ECDC4' };
    return { text: `Lv${level}`, color: '#6b7280' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl bg-white border border-[#e0e0e0] shadow-xl animate-fade-in-up overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#e0e0e0]">
          <div className="flex items-center gap-2.5">
            <Trophy size={24} className="text-amber-500" />
            <h2 className="text-xl font-bold text-[#1a1a2e]">排行榜</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-[#999] hover:text-[#333] hover:bg-[#f0f2f5] transition active:bg-[#e5e5e5]"
          >
            <X size={22} />
          </button>
        </div>

        {/* List */}
        <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-2">
          {entries.length === 0 ? (
            <div className="text-center py-16 text-[#999] text-base">
              暂无排行数据，快来冲榜！
            </div>
          ) : (
            entries.map((entry, i) => {
              const badge = getLevelBadge(entry.level);
              return (
                <div
                  key={entry.wallet}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl ${
                    i < 3 ? 'bg-[#f0f8f5]' : 'bg-white'
                  } border border-[#e0e0e0]`}
                >
                  <div className="w-8 flex-shrink-0 flex justify-center">
                    {getRankIcon(i)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-[#1a1a2e] font-medium truncate">
                      {entry.displayName}
                    </div>
                    <div className="text-xs text-[#999] font-mono truncate">
                      {entry.wallet.slice(0, 8)}...
                    </div>
                  </div>
                  <div
                    className="px-3 py-1 rounded-lg text-sm font-bold"
                    style={{
                      color: badge.color,
                      backgroundColor: `${badge.color}18`,
                    }}
                  >
                    {badge.text}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
