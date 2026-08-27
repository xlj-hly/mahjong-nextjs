import { describe, expect, it } from 'vitest'
import { decompose } from './decompose'
import type { Tile } from './tile'

function parseTiles(spec: string): Tile[] {
  const suitMap: Record<string, Tile['suit']> = {
    m: 'wan',
    p: 'tong',
    s: 'tiao',
  }
  const result: Tile[] = []
  for (let i = 0; i < spec.length; i += 2) {
    const rank = Number(spec[i])
    const suit = suitMap[spec[i + 1]]
    result.push({ suit, rank })
  }
  return result
}

describe('面子拆解算法', () => {
  it('标准和牌拆解（3 顺子 + 1 刻子 + 1 对）', () => {
    const hand = parseTiles('1m2m3m4m5m6m7m8m9m5p5p5p9p9p')
    const decomps = decompose(hand, 4)
    expect(decomps.length).toBeGreaterThan(0)
    const one = decomps[0]
    expect(one.melds).toHaveLength(4)
    expect(one.pair[0]).toEqual({ suit: 'tong', rank: 9 })
  })

  it('不可和牌型返回空', () => {
    // 1m2m3m 4m5m6m 7m8m9m 1p2p3p 4p5p —— 4 顺子后剩 4p5p 无法成对
    const hand = parseTiles('1m2m3m4m5m6m7m8m9m1p2p3p4p5p')
    expect(decompose(hand, 4)).toHaveLength(0)
  })

  it('多解不遗漏不重复', () => {
    // 1m1m1m 1m2m3m 4m5m6m 7m8m9m 9p9p —— 存在多种拆解
    const hand = parseTiles('1m1m1m1m2m3m4m5m6m7m8m9m9p9p')
    const decomps = decompose(hand, 4)
    expect(decomps.length).toBeGreaterThan(0)
    const keys = new Set(
      decomps.map((d) =>
        d.melds
          .map((m) =>
            m.type === 'chow'
              ? `c${m.tiles[0].suit}${m.tiles[0].rank}`
              : `p${m.tile.suit}${m.tile.rank}`,
          )
          .sort()
          .join('|'),
      ),
    )
    expect(keys.size).toBe(decomps.length)
  })
})
