import { describe, expect, it } from 'vitest'
import { Wall } from './wall'
import type { Tile } from './tile'

const tiles: Tile[] = [
  { suit: 'wan', rank: 1 },
  { suit: 'wan', rank: 2 },
  { suit: 'wan', rank: 3 },
]

describe('牌墙模型', () => {
  it('构建并摸牌', () => {
    // 固定 rng 使洗牌可预测：返回 0 保证 Fisher-Yates 退化为不交换。
    const wall = new Wall(tiles, () => 0)
    expect(wall.remaining).toBe(3)
    const drawn = wall.draw()
    expect(drawn).not.toBeNull()
    expect(wall.remaining).toBe(2)
  })

  it('牌墙耗尽返回 null', () => {
    const wall = new Wall([tiles[0]], () => 0)
    expect(wall.draw()).toEqual({ suit: 'wan', rank: 1 })
    expect(wall.draw()).toBeNull()
    expect(wall.isEmpty).toBe(true)
  })
})
