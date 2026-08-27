// 牌张模型：规则无关的统一牌张表示。

export type Suit = 'wan' | 'tong' | 'tiao' | 'wind' | 'dragon' | 'flower'

export interface Tile {
  readonly suit: Suit
  readonly rank: number
}

// 花色排序（用于手牌展示与拆解时的稳定顺序）。
export const SUIT_ORDER: readonly Suit[] = [
  'wan',
  'tong',
  'tiao',
  'wind',
  'dragon',
  'flower',
]

// 风牌 rank 约定：1=东 2=南 3=西 4=北
// 箭牌 rank 约定：1=中 2=发 3=白
// 花牌 rank 约定：1=春 2=夏 3=秋 4=冬 5=梅 6=兰 7=竹 8=菊

export function isNumberSuit(suit: Suit): boolean {
  return suit === 'wan' || suit === 'tong' || suit === 'tiao'
}

export function isHonorSuit(suit: Suit): boolean {
  return suit === 'wind' || suit === 'dragon'
}

export function tileKey(tile: Tile): string {
  return `${tile.suit}${tile.rank}`
}

export function tilesEqual(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

export function compareTiles(a: Tile, b: Tile): number {
  const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit)
  if (suitDiff !== 0) return suitDiff
  return a.rank - b.rank
}

export function sortTiles(tiles: readonly Tile[]): Tile[] {
  return [...tiles].sort(compareTiles)
}

// 将牌按相同牌分组（已排序输入），返回每个组（组内为相同牌的多个实例）。
export function groupTiles(tiles: readonly Tile[]): Tile[][] {
  const sorted = sortTiles(tiles)
  const groups: Tile[][] = []
  for (const t of sorted) {
    const last = groups[groups.length - 1]
    if (last && tilesEqual(last[0], t)) {
      last.push(t)
    } else {
      groups.push([t])
    }
  }
  return groups
}

export function countTiles(tiles: readonly Tile[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tiles) {
    const key = tileKey(t)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

const WIND_NAMES = ['东', '南', '西', '北'] as const
const DRAGON_NAMES = ['中', '发', '白'] as const
const FLOWER_NAMES = ['春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'] as const
const NUMBER_NAMES = [
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
] as const
const SUIT_NAMES = { wan: '万', tong: '筒', tiao: '条' } as const

export function windName(rank: number): string {
  return WIND_NAMES[rank - 1] ?? String(rank)
}

export function dragonName(rank: number): string {
  return DRAGON_NAMES[rank - 1] ?? String(rank)
}

export function flowerName(rank: number): string {
  return FLOWER_NAMES[rank - 1] ?? String(rank)
}

// 单张牌的中文标签（纯数据，供 UI/CLI/番种描述使用，不涉及任何渲染框架）。
export function tileLabel(tile: Tile): string {
  switch (tile.suit) {
    case 'wan':
    case 'tong':
    case 'tiao':
      return `${NUMBER_NAMES[tile.rank - 1] ?? tile.rank}${SUIT_NAMES[tile.suit]}`
    case 'wind':
      return windName(tile.rank)
    case 'dragon':
      return dragonName(tile.rank)
    case 'flower':
      return flowerName(tile.rank)
  }
}
