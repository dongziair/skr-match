import type { Block, LevelConfig, TokenSymbol } from './types';

const ALL_SYMBOLS: TokenSymbol[] = [
  'SOL', 'SKR', 'BONK', 'JUP', 'RAY',
  'ORCA', 'DRIFT', 'PYTH', 'MSOL', 'MNDE',
  'SAMO', 'STEP', 'SRM', 'FIDA', 'ATLAS',
];

export const LEVEL_CONFIGS: LevelConfig[] = [
  // Level 1-5: 新手入门 (Easy)
  { level: 1,  symbolCount: 3,  totalBlocks: 18,  layers: 2, gridWidth: 4, gridHeight: 5 },
  { level: 2,  symbolCount: 3,  totalBlocks: 24,  layers: 2, gridWidth: 4, gridHeight: 5 },
  { level: 3,  symbolCount: 4,  totalBlocks: 30,  layers: 2, gridWidth: 5, gridHeight: 5 },
  { level: 4,  symbolCount: 4,  totalBlocks: 36,  layers: 3, gridWidth: 5, gridHeight: 5 },
  { level: 5,  symbolCount: 5,  totalBlocks: 45,  layers: 3, gridWidth: 5, gridHeight: 6 },
  // Level 6-10: 渐入佳境 (Medium)
  { level: 6,  symbolCount: 6,  totalBlocks: 54,  layers: 3, gridWidth: 6, gridHeight: 6 },
  { level: 7,  symbolCount: 7,  totalBlocks: 66,  layers: 4, gridWidth: 6, gridHeight: 6 },
  { level: 8,  symbolCount: 8,  totalBlocks: 81,  layers: 4, gridWidth: 6, gridHeight: 7 },
  { level: 9,  symbolCount: 9,  totalBlocks: 99,  layers: 5, gridWidth: 7, gridHeight: 7 },
  { level: 10, symbolCount: 10, totalBlocks: 120, layers: 6, gridWidth: 7, gridHeight: 7 },
  // Level 11-15: 指数级膨胀 (Hard)
  { level: 11, symbolCount: 11, totalBlocks: 144, layers: 7, gridWidth: 6, gridHeight: 7 },
  { level: 12, symbolCount: 12, totalBlocks: 168, layers: 8, gridWidth: 6, gridHeight: 7 },
  { level: 13, symbolCount: 13, totalBlocks: 195, layers: 10, gridWidth: 6, gridHeight: 7 },
  { level: 14, symbolCount: 14, totalBlocks: 228, layers: 11, gridWidth: 6, gridHeight: 7 },
  { level: 15, symbolCount: 15, totalBlocks: 264, layers: 13, gridWidth: 6, gridHeight: 7 },
  // Level 16-20: 地狱模式 (Insane) - 不再向广度铺开，纯纯的堆厚度，全面保证图标够大
  { level: 16, symbolCount: 15, totalBlocks: 306, layers: 16, gridWidth: 6, gridHeight: 7 },
  { level: 17, symbolCount: 15, totalBlocks: 351, layers: 18, gridWidth: 6, gridHeight: 7 },
  { level: 18, symbolCount: 15, totalBlocks: 405, layers: 20, gridWidth: 6, gridHeight: 7 },
  { level: 19, symbolCount: 15, totalBlocks: 462, layers: 23, gridWidth: 6, gridHeight: 7 },
  { level: 20, symbolCount: 15, totalBlocks: 525, layers: 26, gridWidth: 6, gridHeight: 7 },
];

export const SYMBOL_COLORS: Record<TokenSymbol, string> = {
  SOL:   '#B57BFF',
  SKR:   '#33FFB8',
  BONK:  '#FFB347',
  JUP:   '#6FFFDC',
  RAY:   '#7DD3FF',
  ORCA:  '#FFE566',
  DRIFT: '#FF8F8F',
  PYTH:  '#EE6FFF',
  MSOL:  '#4DE8F4',
  MNDE:  '#AAED5E',
  SAMO:  '#FFB84D',
  STEP:  '#7B8FFF',
  SRM:   '#5CB8FF',
  FIDA:  '#C06FE8',
  ATLAS: '#FF6B6B',
};

// Token logo — 本地资源 (public/tokens/)
export const SYMBOL_LOGOS: Record<TokenSymbol, string> = {
  SOL:   '/tokens/sol.png',
  SKR:   '/tokens/skr.png',
  BONK:  '/tokens/bonk.jpg',
  JUP:   '/tokens/jup.png',
  RAY:   '/tokens/ray.png',
  ORCA:  '/tokens/orca.png',
  DRIFT: '/tokens/drift.svg',
  PYTH:  '/tokens/pyth.png',
  MSOL:  '/tokens/msol.png',
  MNDE:  '/tokens/mnde.png',
  SAMO:  '/tokens/samo.png',
  STEP:  '/tokens/step.png',
  SRM:   '/tokens/srm.png',
  FIDA:  '/tokens/fida.svg',
  ATLAS: '/tokens/atlas.png',
};

// Fallback emoji icons when logo fails to load
export const SYMBOL_ICONS: Record<TokenSymbol, string> = {
  SOL:   '◎',
  SKR:   '✦',
  BONK:  '🐕',
  JUP:   '♃',
  RAY:   '☀',
  ORCA:  '🐋',
  DRIFT: '↗',
  PYTH:  '🔮',
  MSOL:  '◈',
  MNDE:  '◆',
  SAMO:  '🐶',
  STEP:  '⬡',
  SRM:   '⬢',
  FIDA:  '◇',
  ATLAS: '🌍',
};

let blockIdCounter = 0;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateSymbolPool(symbolCount: number, totalBlocks: number): TokenSymbol[] {
  const symbols = ALL_SYMBOLS.slice(0, symbolCount);
  const pool: TokenSymbol[] = [];
  const triplets = totalBlocks / 3;
  for (let i = 0; i < triplets; i++) {
    const sym = symbols[i % symbols.length];
    pool.push(sym, sym, sym);
  }
  return shuffle(pool);
}

function isOverlapping(a: Block, b: Block): boolean {
  // 两个方块只要在 x 和 y 上都有重叠（不到 1 格距离），就算被压住
  // 使用 < 1.0 精确匹配：半格偏移的方块（0.5 距离）会被检测到，
  // 而相邻整数格（1.0 距离）不会误判
  return Math.abs(a.x - b.x) < 1.0 && Math.abs(a.y - b.y) < 1.0;
}

export function computeClickable(blocks: Block[]): Block[] {
  return blocks.map(block => {
    if (block.isInSlot) return { ...block, isClickable: false };
    const isBlocked = blocks.some(
      other =>
        !other.isInSlot &&
        other.z > block.z &&
        isOverlapping(block, other)
    );
    return { ...block, isClickable: !isBlocked };
  });
}

export function generateBlocks(config: LevelConfig): Block[] {
  const { totalBlocks, layers, gridWidth, gridHeight, symbolCount } = config;
  const symbolPool = generateSymbolPool(symbolCount, totalBlocks);
  const blocks: Block[] = [];
  let poolIndex = 0;
  const blocksPerLayer = Math.ceil(totalBlocks / layers);

  for (let z = 0; z < layers; z++) {
    const layerBlockCount = Math.min(blocksPerLayer, totalBlocks - poolIndex);
    // 奇数层偏移半格，产生经典的「羊了个羊」交错覆盖效果
    // 同一层内所有方块使用相同偏移，避免同层方块之间视觉重叠
    const layerOffset = z % 2 === 1 ? 0.5 : 0;
    const positions: Array<[number, number]> = [];
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        positions.push([x, y]);
      }
    }
    const selectedPositions = shuffle(positions).slice(0, layerBlockCount);

    for (const [x, y] of selectedPositions) {
      if (poolIndex >= symbolPool.length) break;
      blocks.push({
        id: `block-${blockIdCounter++}`,
        symbol: symbolPool[poolIndex++],
        x: x + layerOffset,
        y: y + layerOffset,
        z,
        isClickable: false,
        isInSlot: false,
      });
    }
  }
  return computeClickable(blocks);
}

export function moveToSlot(
  blocks: Block[],
  slots: (Block | null)[],
  blockId: string
): {
  newBlocks: Block[];
  newSlots: (Block | null)[];
  matched: boolean;
  matchedSymbol: TokenSymbol | null;
} {
  const block = blocks.find(b => b.id === blockId);
  if (!block || !block.isClickable || block.isInSlot) {
    return { newBlocks: blocks, newSlots: slots, matched: false, matchedSymbol: null };
  }

  let newBlocks = blocks.map(b =>
    b.id === blockId ? { ...b, isInSlot: true, isClickable: false } : b
  );

  const movedBlock = { ...block, isInSlot: true, isClickable: false };
  const newSlots = [...slots];

  let insertIndex = -1;
  for (let i = 0; i < newSlots.length; i++) {
    if (newSlots[i] && newSlots[i]!.symbol === movedBlock.symbol) {
      insertIndex = i + 1;
    }
  }

  if (insertIndex === -1) {
    insertIndex = newSlots.findIndex(s => s === null);
  }

  if (insertIndex === -1 || insertIndex >= 7) {
    insertIndex = newSlots.findIndex(s => s === null);
    if (insertIndex === -1) {
      return { newBlocks: blocks, newSlots: slots, matched: false, matchedSymbol: null };
    }
  }

  newSlots.splice(insertIndex, 0, movedBlock);
  const lastNullIdx = newSlots.lastIndexOf(null);
  if (lastNullIdx !== -1 && newSlots.length > 7) {
    newSlots.splice(lastNullIdx, 1);
  }
  while (newSlots.length > 7) newSlots.pop();

  let matched = false;
  let matchedSymbol: TokenSymbol | null = null;
  const symbolCounts: Record<string, number> = {};
  for (const s of newSlots) {
    if (s) {
      symbolCounts[s.symbol] = (symbolCounts[s.symbol] || 0) + 1;
    }
  }

  for (const [sym, count] of Object.entries(symbolCounts)) {
    if (count >= 3) {
      matched = true;
      matchedSymbol = sym as TokenSymbol;
      break;
    }
  }

  if (matched && matchedSymbol) {
    let removed = 0;
    const filteredSlots: (Block | null)[] = [];
    for (const s of newSlots) {
      if (s && s.symbol === matchedSymbol && removed < 3) {
        newBlocks = newBlocks.filter(b => b.id !== s.id);
        removed++;
      } else {
        filteredSlots.push(s);
      }
    }
    while (filteredSlots.length < 7) filteredSlots.push(null);
    newBlocks = computeClickable(newBlocks);
    return { newBlocks, newSlots: filteredSlots, matched: true, matchedSymbol };
  }

  newBlocks = computeClickable(newBlocks);
  return { newBlocks, newSlots, matched: false, matchedSymbol: null };
}

export function powerUpRemove3(
  blocks: Block[],
  slots: (Block | null)[]
): { newBlocks: Block[]; newSlots: (Block | null)[] } {
  const slotsToRemove = slots.filter(s => s !== null).slice(0, 3);
  if (slotsToRemove.length === 0) return { newBlocks: blocks, newSlots: slots };

  const removeIds = new Set(slotsToRemove.map(s => s!.id));
  let newBlocks = blocks.map(b =>
    removeIds.has(b.id) ? { ...b, isInSlot: false } : b
  );
  newBlocks = computeClickable(newBlocks);

  let newSlots = slots.map(s => (s && removeIds.has(s.id) ? null : s));
  const compacted = newSlots.filter(s => s !== null);
  newSlots = [...compacted];
  while (newSlots.length < 7) newSlots.push(null);
  return { newBlocks, newSlots };
}

export function powerUpUndo(
  blocks: Block[],
  slots: (Block | null)[]
): { newBlocks: Block[]; newSlots: (Block | null)[]; undoneBlock: Block | null } {
  let lastIdx = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i] !== null) { lastIdx = i; break; }
  }
  if (lastIdx === -1) return { newBlocks: blocks, newSlots: slots, undoneBlock: null };

  const undoneBlock = slots[lastIdx]!;
  let newBlocks = blocks.map(b =>
    b.id === undoneBlock.id ? { ...b, isInSlot: false } : b
  );
  newBlocks = computeClickable(newBlocks);

  const newSlots = [...slots];
  newSlots[lastIdx] = null;
  const compacted = newSlots.filter(s => s !== null);
  const result: (Block | null)[] = [...compacted];
  while (result.length < 7) result.push(null);
  return { newBlocks, newSlots: result, undoneBlock };
}

export function powerUpShuffle(blocks: Block[]): Block[] {
  const fieldBlocks = blocks.filter(b => !b.isInSlot);
  const slotBlocks = blocks.filter(b => b.isInSlot);
  const symbols = fieldBlocks.map(b => b.symbol);
  const shuffled = shuffle(symbols);
  const newFieldBlocks = fieldBlocks.map((b, i) => ({ ...b, symbol: shuffled[i] }));
  return computeClickable([...newFieldBlocks, ...slotBlocks]);
}

export function checkWin(blocks: Block[]): boolean {
  return blocks.filter(b => !b.isInSlot).length === 0;
}

export function checkLoss(slots: (Block | null)[]): boolean {
  const filled = slots.filter(s => s !== null);
  if (filled.length < 7) return false;
  const counts: Record<string, number> = {};
  for (const s of filled) {
    if (s) {
      counts[s.symbol] = (counts[s.symbol] || 0) + 1;
      if (counts[s.symbol] >= 3) return false;
    }
  }
  return true;
}

export function resetBlockIdCounter(): void {
  blockIdCounter = 0;
}
