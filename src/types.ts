/** 
 * Solana Match 游戏类型定义
 */

// 代币图案枚举
export type TokenSymbol =
  | 'SOL' | 'SKR' | 'BONK' | 'JUP' | 'RAY'
  | 'ORCA' | 'DRIFT' | 'PYTH' | 'MSOL' | 'MNDE'
  | 'SAMO' | 'STEP' | 'SRM' | 'FIDA' | 'ATLAS';

// 单个方块
export interface Block {
  id: string;           // 唯一标识
  symbol: TokenSymbol;  // 代币图案
  x: number;            // 网格 x 坐标
  y: number;            // 网格 y 坐标
  z: number;            // 层级（0 = 最底层）
  isClickable: boolean; // 是否可点击（未被上层遮挡）
  isInSlot: boolean;    // 是否已移入卡槽
}

// 卡槽状态
export interface Slot {
  block: Block | null;
}

// 关卡配置
export interface LevelConfig {
  level: number;
  symbolCount: number;    // 使用的代币种类数
  totalBlocks: number;    // 方块总数（3 的倍数）
  layers: number;         // 层数
  gridWidth: number;      // 网格宽度
  gridHeight: number;     // 网格高度
}

// 道具类型
export type PowerUpType = 'remove3' | 'undo' | 'shuffle';

// 道具配置
export interface PowerUp {
  type: PowerUpType;
  name: string;
  description: string;
  cost: number; // 以 $SKR 计价
  icon: string;
}

// 游戏状态
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';
