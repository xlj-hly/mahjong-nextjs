// 规则无关的面子拆解算法：回溯枚举「N 个面子 + 1 对将」的所有互异拆解。
// 面子为顺子（chow）或刻子（pung）；杠（kong）作为已固定的副露在拆解之外处理。

import { groupTiles, isNumberSuit, tilesEqual, type Tile } from './tile'

export type Meld =
  | { type: 'chow'; tiles: [Tile, Tile, Tile]; concealed: boolean }
  | { type: 'pung'; tile: Tile; concealed: boolean }
  | { type: 'kong'; tile: Tile; concealed: boolean }

export interface Decomposition {
  melds: Meld[]
  pair: [Tile, Tile]
}

// 将一副手牌拆成 meldCount 个面子 + 1 对将。tiles 为不含花牌、不含副露的隐藏手牌。
export function decompose(
  tiles: readonly Tile[],
  meldCount: number,
): Decomposition[] {
  const groups = groupTiles(tiles)
  const seen = new Set<string>()
  const results: Decomposition[] = []

  for (const g of groups) {
    if (g.length < 2) continue

    // 用该组两张作为将牌，剩余牌拆成 meldCount 个面子。
    const remaining: Tile[] = []
    for (const grp of groups) {
      if (grp === g) {
        if (grp.length > 2) remaining.push(...grp.slice(2))
      } else {
        remaining.push(...grp)
      }
    }

    const pair: [Tile, Tile] = [g[0], g[0]]
    for (const melds of solveMelds(remaining, meldCount)) {
      const decomp: Decomposition = { melds, pair }
      const key = decompositionKey(decomp)
      if (!seen.has(key)) {
        seen.add(key)
        results.push(decomp)
      }
    }
  }

  return results
}

function meldKey(meld: Meld): string {
  if (meld.type === 'chow') return `c${meld.tiles[0].suit}${meld.tiles[0].rank}`
  if (meld.type === 'pung') return `p${meld.tile.suit}${meld.tile.rank}`
  return `k${meld.tile.suit}${meld.tile.rank}`
}

function decompositionKey(decomp: Decomposition): string {
  const pairKey = `pair:${decomp.pair[0].suit}${decomp.pair[0].rank}`
  const meldKeys = decomp.melds.map(meldKey).sort().join('|')
  return `${pairKey}|${meldKeys}`
}

function solveMelds(tiles: Tile[], n: number): Meld[][] {
  if (n === 0) {
    return tiles.length === 0 ? [[]] : []
  }
  if (tiles.length < 3) return []

  const first = tiles[0]
  const results: Meld[][] = []

  // 尝试刻子
  if (
    tiles.length >= 3 &&
    tilesEqual(tiles[1], first) &&
    tilesEqual(tiles[2], first)
  ) {
    const rest = tiles.slice(3)
    for (const sub of solveMelds(rest, n - 1)) {
      results.push([{ type: 'pung', tile: first, concealed: true }, ...sub])
    }
  }

  // 尝试顺子
  if (isNumberSuit(first.suit) && first.rank <= 7) {
    const idx1 = tiles.findIndex(
      (t) => t.suit === first.suit && t.rank === first.rank + 1,
    )
    const idx2 = tiles.findIndex(
      (t) => t.suit === first.suit && t.rank === first.rank + 2,
    )
    if (idx1 !== -1 && idx2 !== -1) {
      const t1 = tiles[idx1]
      const t2 = tiles[idx2]
      const rest = tiles.filter((_, i) => i !== 0 && i !== idx1 && i !== idx2)
      for (const sub of solveMelds(rest, n - 1)) {
        results.push([
          { type: 'chow', tiles: [first, t1, t2], concealed: true },
          ...sub,
        ])
      }
    }
  }

  return results
}
