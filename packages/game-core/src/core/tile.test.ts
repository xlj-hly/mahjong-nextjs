import { describe, expect, it } from 'vitest'
import {
  countTiles,
  isNumberSuit,
  sortTiles,
  tileLabel,
  tilesEqual,
} from './tile'

describe('牌张模型', () => {
  it('数牌判等', () => {
    expect(tilesEqual({ suit: 'wan', rank: 5 }, { suit: 'wan', rank: 5 })).toBe(
      true,
    )
    expect(tilesEqual({ suit: 'wan', rank: 5 }, { suit: 'wan', rank: 6 })).toBe(
      false,
    )
    expect(
      tilesEqual({ suit: 'wan', rank: 5 }, { suit: 'tong', rank: 5 }),
    ).toBe(false)
  })

  it('花牌不属于数牌', () => {
    expect(isNumberSuit('flower')).toBe(false)
    expect(isNumberSuit('wan')).toBe(true)
  })

  it('分组计数', () => {
    const counts = countTiles([
      { suit: 'wan', rank: 1 },
      { suit: 'wan', rank: 1 },
      { suit: 'wan', rank: 2 },
    ])
    expect(counts.get('wan1')).toBe(2)
    expect(counts.get('wan2')).toBe(1)
  })

  it('中文标签', () => {
    expect(tileLabel({ suit: 'wan', rank: 5 })).toBe('五万')
    expect(tileLabel({ suit: 'wind', rank: 1 })).toBe('东')
    expect(tileLabel({ suit: 'dragon', rank: 2 })).toBe('发')
    expect(tileLabel({ suit: 'flower', rank: 1 })).toBe('春')
  })

  it('排序稳定（花色序 + 点数序）', () => {
    const sorted = sortTiles([
      { suit: 'tong', rank: 1 },
      { suit: 'wan', rank: 9 },
      { suit: 'wan', rank: 1 },
    ])
    expect(sorted.map((t) => `${t.suit}${t.rank}`)).toEqual([
      'wan1',
      'wan9',
      'tong1',
    ])
  })
})
