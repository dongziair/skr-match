/**
 * AdminPanel.tsx
 * 玩家数据管理面板 — 查看、导出CSV、导入CSV修改
 * 风格：赛博朋克毛玻璃卡片
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, Upload, RefreshCw, Users, Shield } from 'lucide-react';
import {
  getAllPlayers,
  downloadPlayersCsv,
  importPlayersCsv,
  type PlayerData,
} from './ProgressStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AdminPanel({ visible, onClose }: Props) {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setPlayers(getAllPlayers());
  }, []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleExport = () => {
    downloadPlayersCsv();
    showToast(`✅ 已导出 ${players.length} 条记录`);
  };

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const count = importPlayersCsv(text);
      showToast(count > 0 ? `✅ 成功导入 ${count} 条记录` : '❌ 导入失败，请检查CSV格式');
      refresh();
    };
    reader.readAsText(file, 'utf-8');

    // 重置 input 允许再次选择同一文件
    e.target.value = '';
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }}>
      <div
        className="relative w-full max-w-[400px] mx-3 rounded-2xl overflow-hidden animate-modal-pop"
        style={{
          maxHeight: '82vh',
          background: 'linear-gradient(180deg, rgba(12,18,35,0.97) 0%, rgba(8,12,24,0.99) 100%)',
          border: '1px solid rgba(0,255,170,0.08)',
          boxShadow: '0 0 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,170,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* ====== 标题栏 ====== */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(0,255,170,0.06)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,255,170,0.15), rgba(124,58,237,0.1))', border: '1px solid rgba(0,255,170,0.12)' }}>
              <Shield size={14} className="text-[#00ffaa]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#e0e6f0] leading-none">玩家数据</h2>
              <p className="text-[8px] text-[#475569] mt-0.5">PLAYER DATABASE</p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ color: '#00ffaa', background: 'rgba(0,255,170,0.08)', border: '1px solid rgba(0,255,170,0.12)' }}>
              {players.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={refresh} className="p-1.5 rounded-lg text-[#475569] hover:text-[#00ffaa] hover:bg-white/5 transition" title="刷新">
              <RefreshCw size={13} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-white hover:bg-white/10 transition">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ====== 操作栏：导出 + 导入 ====== */}
        <div className="flex gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, rgba(0,255,170,0.12), rgba(0,204,130,0.06))',
              border: '1px solid rgba(0,255,170,0.15)',
              color: '#00ffaa',
              boxShadow: '0 0 12px rgba(0,255,170,0.05)',
            }}
          >
            <Download size={14} /> 导出 CSV
          </button>
          <button
            onClick={handleImportClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(167,139,250,0.06))',
              border: '1px solid rgba(124,58,237,0.15)',
              color: '#a78bfa',
              boxShadow: '0 0 12px rgba(124,58,237,0.05)',
            }}
          >
            <Upload size={14} /> 导入 CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* ====== 表头 ====== */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 px-3 py-1.5 text-[8px] uppercase tracking-widest text-[#475569] font-bold" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span>玩家 / 域名</span>
          <span className="w-[60px] text-center">道具</span>
          <span className="w-[32px] text-right">关卡</span>
        </div>

        {/* ====== 玩家列表 ====== */}
        <div className="overflow-y-auto custom-scroll" style={{ maxHeight: 'calc(82vh - 150px)' }}>
          {players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-[#334155]">
              <Users size={28} className="mb-2 opacity-20" />
              <p className="text-xs text-[#475569]">暂无玩家数据</p>
              <p className="text-[9px] text-[#334155] mt-0.5">连接钱包开始游戏后将自动记录</p>
            </div>
          ) : (
            <div className="px-2 py-1.5">
              {players.map((p, idx) => {
                const hasDomain = !p.displayName.includes('...');
                const shortWallet = `${p.wallet.slice(0, 4)}...${p.wallet.slice(-4)}`;
                const totalItems = p.inventory.remove3 + p.inventory.undo + p.inventory.shuffle;

                return (
                  <div
                    key={p.wallet}
                    className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center px-2 py-2 rounded-lg transition-all hover:bg-white/[0.02]"
                    style={{
                      borderBottom: idx < players.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                    }}
                  >
                    {/* 玩家信息 */}
                    <div className="min-w-0">
                      {hasDomain ? (
                        <>
                          <p className="text-[11px] font-bold text-[#00ffaa] truncate leading-tight" style={{ textShadow: '0 0 6px rgba(0,255,170,0.3)' }}>
                            {p.displayName}
                          </p>
                          <p className="text-[8px] text-[#334155] font-mono truncate leading-tight mt-0.5">{shortWallet}</p>
                        </>
                      ) : (
                        <p className="text-[10px] text-[#94a3b8] font-mono truncate leading-tight">{shortWallet}</p>
                      )}
                    </div>

                    {/* 道具数量 */}
                    <div className="w-[60px] flex items-center justify-center gap-1">
                      <span className="text-[8px] px-1 py-0.5 rounded" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                        {p.inventory.remove3}
                      </span>
                      <span className="text-[8px] px-1 py-0.5 rounded" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }}>
                        {p.inventory.undo}
                      </span>
                      <span className="text-[8px] px-1 py-0.5 rounded" style={{ color: '#a78bfa', background: 'rgba(124,58,237,0.08)' }}>
                        {p.inventory.shuffle}
                      </span>
                    </div>

                    {/* 关卡 */}
                    <div className="w-[32px] text-right">
                      <span
                        className="text-sm font-black"
                        style={{
                          color: p.currentLevel >= 16 ? '#FF6B6B' : p.currentLevel >= 11 ? '#FF9800' : p.currentLevel >= 6 ? '#FFD93D' : '#00ffaa',
                          textShadow: '0 0 8px currentColor',
                        }}
                      >
                        {p.currentLevel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ====== 底部提示 ====== */}
        <div className="px-3 py-2 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <p className="text-[8px] text-[#334155]">
            导出 CSV → 用 Excel 编辑 → 导入覆盖
          </p>
        </div>

        {/* ====== Toast ====== */}
        {toast && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-[11px] font-medium animate-fade-in-up whitespace-nowrap"
            style={{ background: 'rgba(10,14,26,0.95)', color: '#00ffaa', border: '1px solid rgba(0,255,170,0.15)', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
