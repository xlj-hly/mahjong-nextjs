// 四川麻将牌种集合：108 张 = 万/筒/条各 36（1–9 各 4），无字牌、无花牌。

import { Wall } from '../../core/wall'
import type { Tile } from '../../core/tile'

const NUMBER_SUITS = ['wan', 'tong', 'tiao'] as const

export function buildTileSet(): Tile[] {
  const tiles: Tile[] = []
  for (const suit of NUMBER_SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let i = 0; i < 4; i++) tiles.push({ suit, rank })
    }
  }
  return tiles
}

export function buildWall(rng?: () => number): Wall {
  return new Wall(buildTileSet(), rng)
}
