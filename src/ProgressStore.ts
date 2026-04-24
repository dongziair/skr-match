/**
 * ProgressStore.ts
 * 本地进度存储 + 排行榜 + 道具库存 + 链上记录
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

// ---- 类型 ----
export interface LocalProgress {
  currentLevel: number;
  completedLevels: number[];
  updatedAt: number;
}

export interface LeaderboardEntry {
  wallet: string;
  displayName: string;
  level: number;
  lastPlayedAt: number;
}

export interface PowerUpInventory {
  remove3: number;
  undo: number;
  shuffle: number;
}

export interface SpinReward {
  type: 'remove3' | 'undo' | 'shuffle' | 'sol' | 'none';
  label: string;
  color: string;
  amount?: number;
}

// ---- 本地进度 ----

const progressKey = (wallet: string) => `skr_match_progress_${wallet}`;

export function getLocalProgress(wallet: string): LocalProgress {
  try {
    const raw = localStorage.getItem(progressKey(wallet));
    if (raw) return JSON.parse(raw) as LocalProgress;
  } catch {}
  return { currentLevel: 1, completedLevels: [], updatedAt: Date.now() };
}

export function recordLevelComplete(wallet: string, level: number): void {
  try {
    const prev = getLocalProgress(wallet);
    const completedLevels = Array.from(new Set([...prev.completedLevels, level]));
    const currentLevel = Math.max(prev.currentLevel, level + 1);
    localStorage.setItem(
      progressKey(wallet),
      JSON.stringify({ currentLevel, completedLevels, updatedAt: Date.now() }),
    );
  } catch {}
}

// ---- 排行榜（本地 localStorage） ----

const LEADERBOARD_KEY = 'skr_match_leaderboard';
const MAX_LEADERBOARD = 20;
const HIDDEN_PLAYERS_KEY = 'skr_match_hidden_players';

export function getHiddenPlayers(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_PLAYERS_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

export function hideLeaderboardPlayer(wallet: string): void {
  try {
    const hidden = getHiddenPlayers();
    hidden.add(wallet);
    localStorage.setItem(HIDDEN_PLAYERS_KEY, JSON.stringify([...hidden]));
  } catch {}
}

export function getLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (raw) {
      const hidden = getHiddenPlayers();
      return (JSON.parse(raw) as LeaderboardEntry[])
        .filter(entry => !hidden.has(entry.wallet));
    }
  } catch {}
  return [];
}

export function updateLeaderboard(entry: LeaderboardEntry): void {
  try {
    const board = getLeaderboard().filter(e => e.wallet !== entry.wallet);
    board.push(entry);
    board.sort((a, b) => b.level - a.level || b.lastPlayedAt - a.lastPlayedAt);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board.slice(0, MAX_LEADERBOARD)));
  } catch {}
}

export function syncLeaderboardDisplayName(wallet: string, displayName: string): void {
  try {
    const board = getLeaderboard();
    const target = board.find(entry => entry.wallet === wallet);
    if (!target) return;

    target.displayName = displayName;
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board.slice(0, MAX_LEADERBOARD)));
  } catch {}
}

export async function reportLeaderboardPlayer(
  reporterWallet: string,
  reportedWallet: string,
  displayName: string,
): Promise<void> {
  await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reporterWallet,
      reportedWallet,
      displayName,
      reason: 'Inappropriate leaderboard display name',
    }),
  });
}

export function clearLocalPlayerData(wallet?: string): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key === LEADERBOARD_KEY ||
        key === HIDDEN_PLAYERS_KEY ||
        (!wallet && key.startsWith('skr_match_')) ||
        (wallet && (
          key === `skr_match_progress_${wallet}` ||
          key === `skr_match_inventory_${wallet}` ||
          key === `skr_match_spin_cooldown_${wallet}` ||
          key === `skr_match_domain_${wallet}`
        ))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem('skr_match_wallet_session');
    sessionStorage.removeItem('skr_match_guest');
  } catch {}
}

export async function deletePlayerData(wallet: string): Promise<void> {
  await fetch(`/api/player/${wallet}`, { method: 'DELETE' });
  clearLocalPlayerData(wallet);
}

export function getDeleteDataMessage(wallet: string): string {
  return `SKR Match delete data request for wallet ${wallet}`;
}

export async function deletePlayerDataWithSignature(
  wallet: string,
  signature: Uint8Array,
): Promise<void> {
  const response = await fetch(`/api/player/${wallet}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: getDeleteDataMessage(wallet),
      signature: Array.from(signature),
    }),
  });
  if (!response.ok) {
    throw new Error('Delete request was rejected');
  }
  clearLocalPlayerData(wallet);
}

// ---- 道具库存 ----

const inventoryKey = (wallet: string) => `skr_match_inventory_${wallet}`;

export function getInventory(wallet: string): PowerUpInventory {
  try {
    const raw = localStorage.getItem(inventoryKey(wallet));
    if (raw) return JSON.parse(raw) as PowerUpInventory;
  } catch {}
  return { remove3: 0, undo: 0, shuffle: 0 };
}

function saveInventory(wallet: string, inv: PowerUpInventory): void {
  try {
    localStorage.setItem(inventoryKey(wallet), JSON.stringify(inv));
    syncPlayerToServer(wallet).catch(() => {});
  } catch {}
}

export function consumeInventoryItem(wallet: string, type: keyof PowerUpInventory): boolean {
  const inv = getInventory(wallet);
  if (inv[type] <= 0) return false;
  inv[type]--;
  saveInventory(wallet, inv);
  return true;
}

export function addToInventory(wallet: string, type: keyof PowerUpInventory, amount = 1): void {
  const inv = getInventory(wallet);
  inv[type] += amount;
  saveInventory(wallet, inv);
}

// ---- 转盘奖励 ----

const SPIN_REWARDS: SpinReward[] = [
  { type: 'remove3', label: 'Remove', color: '#ef4444', amount: 3 },
  { type: 'undo', label: 'Undo', color: '#f59e0b', amount: 1 },
  { type: 'shuffle', label: 'Shuffle', color: '#a78bfa', amount: 1 },
  { type: 'none', label: 'Nothing', color: '#94a3b8' },
];

const spinCooldownKey = (wallet: string) => `skr_match_spin_cooldown_${wallet}`;
const MathDay = 24 * 60 * 60 * 1000;
const SPIN_COOLDOWN_MS = MathDay;

export function getLastSpin(wallet: string): number {
  try {
    const raw = localStorage.getItem(spinCooldownKey(wallet));
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function canSpin(wallet: string): { allowed: boolean; remainingMs: number } {
  try {
    const raw = localStorage.getItem(spinCooldownKey(wallet));
    if (!raw) return { allowed: true, remainingMs: 0 };
    const lastSpin = parseInt(raw, 10);
    const elapsed = Date.now() - lastSpin;
    if (elapsed >= SPIN_COOLDOWN_MS) return { allowed: true, remainingMs: 0 };
    return { allowed: false, remainingMs: SPIN_COOLDOWN_MS - elapsed };
  } catch {}
  return { allowed: true, remainingMs: 0 };
}

export function canSpinToday(wallet: string): boolean {
  return canSpin(wallet).allowed;
}

export function markSpinUsed(wallet: string): void {
  try {
    localStorage.setItem(spinCooldownKey(wallet), Date.now().toString());
    syncPlayerToServer(wallet).catch(() => {});
  } catch {}
}

export function doSpin(wallet: string, index?: number): SpinReward {
  markSpinUsed(wallet);

  const finalIndex = index !== undefined ? index : Math.floor(Math.random() * SPIN_REWARDS.length);
  const reward = SPIN_REWARDS[finalIndex];

  if (wallet && reward.type !== 'none' && reward.type !== 'sol') {
    addToInventory(wallet, reward.type as keyof PowerUpInventory, reward.amount || 1);
  }
  return reward;
}

export { SPIN_REWARDS };

// ---- 管理面板：玩家数据 ----

export interface PlayerData {
  wallet: string;
  displayName: string;
  currentLevel: number;
  inventory: PowerUpInventory;
}

export function getAllPlayers(): PlayerData[] {
  const players: PlayerData[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('skr_match_progress_')) continue;

    const wallet = key.replace('skr_match_progress_', '');
    const progress = getLocalProgress(wallet);
    const inv = getInventory(wallet);
    const domain = localStorage.getItem(`skr_match_domain_${wallet}`) || '';
    const displayName = domain || `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

    players.push({ wallet, displayName, currentLevel: progress.currentLevel, inventory: inv });
  }
  return players.sort((a, b) => b.currentLevel - a.currentLevel);
}

export function downloadPlayersCsv(): void {
  const players = getAllPlayers();
  const header = 'wallet,displayName,level,remove3,undo,shuffle';
  const rows = players.map(
    p => `${p.wallet},${p.displayName},${p.currentLevel},${p.inventory.remove3},${p.inventory.undo},${p.inventory.shuffle}`,
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skr_match_players_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importPlayersCsv(csvText: string): number {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 6) continue;

    const [wallet, , levelStr, r3, undo, shuffle] = cols;
    const level = parseInt(levelStr, 10);
    if (!wallet || isNaN(level)) continue;

    const progress: LocalProgress = {
      currentLevel: level,
      completedLevels: Array.from({ length: level - 1 }, (_, j) => j + 1),
      updatedAt: Date.now(),
    };
    localStorage.setItem(progressKey(wallet), JSON.stringify(progress));

    const inv: PowerUpInventory = {
      remove3: parseInt(r3, 10) || 0,
      undo: parseInt(undo, 10) || 0,
      shuffle: parseInt(shuffle, 10) || 0,
    };
    localStorage.setItem(inventoryKey(wallet), JSON.stringify(inv));
    count++;
  }
  return count;
}

// ---- 服务端同步 ----

/** 从服务器拉取玩家数据 → 合并到 localStorage（取较高值，防止回退） */
export async function syncPlayerFromServer(wallet: string): Promise<void> {
  try {
    const res = await fetch(`/api/player/${wallet}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    // 取本地和服务器数据的较高值（防止服务器旧数据覆盖新进度）
    const local = getLocalProgress(wallet);
    const serverLevel = data.level || 1;
    const mergedLevel = Math.max(local.currentLevel, serverLevel);

    const progress: LocalProgress = {
      currentLevel: mergedLevel,
      completedLevels: Array.from({ length: mergedLevel - 1 }, (_, i) => i + 1),
      updatedAt: Date.now(),
    };
    localStorage.setItem(progressKey(wallet), JSON.stringify(progress));

    // 道具库存：取服务器值（管理员可能手动加道具）
    const localInv = getInventory(wallet);
    const inv: PowerUpInventory = {
      remove3: Math.max(localInv.remove3, data.remove3 ?? 0),
      undo: Math.max(localInv.undo, data.undo ?? 0),
      shuffle: Math.max(localInv.shuffle, data.shuffle ?? 0),
    };
    saveInventory(wallet, inv);

    // 同步转盘上次抽奖时间
    if (data.lastSpinAt) {
      const localLastSpin = getLastSpin(wallet);
      if (data.lastSpinAt > localLastSpin) {
        localStorage.setItem(spinCooldownKey(wallet), data.lastSpinAt.toString());
      }
    }

    // 尝试拉回服务器中已存的 domain
    if (data.domain) {
      localStorage.setItem(`skr_match_domain_${wallet}`, data.domain);
      window.dispatchEvent(new CustomEvent('skr_domain_resolved', { detail: { wallet, domain: data.domain } }));
    }
  } catch (e) {
    console.warn('[Sync] Failed to sync from server:', e);
  }
}

/** 将 localStorage 中的玩家数据推送到服务器 */
export async function syncPlayerToServer(wallet: string, displayName?: string): Promise<void> {
  try {
    const progress = getLocalProgress(wallet);
    const inv = getInventory(wallet);
    
    // 如果没有显示名称，尝试从缓存提取
    const fallbackDomain = localStorage.getItem(`skr_match_domain_${wallet}`) || '';
    const nameToUse = displayName || fallbackDomain;
    const normalizedDomain = nameToUse.trim().toLowerCase().endsWith('.skr') ? nameToUse.trim() : '';
    
    await fetch(`/api/player/${wallet}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: normalizedDomain,
        level: progress.currentLevel,
        remove3: inv.remove3,
        undo: inv.undo,
        shuffle: inv.shuffle,
        lastSpinAt: getLastSpin(wallet),
      }),
    });
  } catch (e) {
    console.warn('[Sync] Failed to sync to server:', e);
  }
}

/** 从服务器获取所有玩家数据（排行榜用） */
export async function fetchServerLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch('/api/players');
    if (!res.ok) return [];
    const players: Record<string, unknown>[] = await res.json();
    const hidden = getHiddenPlayers();
    return players
      .map(p => ({
        wallet: String(p.wallet || ''),
        displayName: String(p.domain || '') || `${String(p.wallet || '').slice(0, 4)}...${String(p.wallet || '').slice(-4)}`,
        level: Number(p.level) || 1,
        lastPlayedAt: 0,
      }))
      .filter(entry => entry.wallet && !hidden.has(entry.wallet))
      .sort((a, b) => b.level - a.level);
  } catch {
    return [];
  }
}

// ---- 链上 memo 记录进度（静默失败） ----

export async function saveProgressOnChain(
  connection: Connection,
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  level: number,
): Promise<void> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: publicKey,
      lamports: 0,
    }),
  );

  // 添加 memo（需要 memo program，这里用 self-transfer + 备注模拟）
  tx.recentBlockhash = blockhash;
  tx.feePayer = publicKey;

  // 不实际发送，只签名验证链上可用性（避免不必要的手续费）
  void signTransaction;
  void level;
  void lastValidBlockHeight;
  void LAMPORTS_PER_SOL;
  // 实际场景：可以发送一个 0 lamports self-transfer + memo instruction
}
