// 国标麻将牌种集合：144 张 = 万/筒/条各 36 + 风 16 + 箭 12 + 花 8。

import { Wall } from '../../core/wall'
import type { Tile } from '../../core/tile'

const NUMBER_SUITS = ['wan', 'tong', 'tiao'] as const

export function buildTileSet(): Tile[] {
  const tiles: Tile[] = []

  // 数牌：万/筒/条 1–9 各 4 张
  for (const suit of NUMBER_SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let i = 0; i < 4; i++) tiles.push({ suit, rank })
    }
  }

  // 风牌：东南西北各 4 张
  for (let rank = 1; rank <= 4; rank++) {
    for (let i = 0; i < 4; i++) tiles.push({ suit: 'wind', rank })
  }

  // 箭牌：中发白各 4 张
  for (let rank = 1; rank <= 3; rank++) {
    for (let i = 0; i < 4; i++) tiles.push({ suit: 'dragon', rank })
  }

  // 花牌：春夏秋冬梅兰竹菊各 1 张
  for (let rank = 1; rank <= 8; rank++) {
    tiles.push({ suit: 'flower', rank })
  }

  return tiles
}

export function buildWall(rng?: () => number): Wall {
  return new Wall(buildTileSet(), rng)
}
