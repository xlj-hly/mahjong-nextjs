// 牌墙模型：按给定牌张集合构建、洗牌、摸牌，摸空时返回耗尽状态。

import type { Tile } from './tile'

export class Wall {
  private tiles: Tile[]
  private rng: () => number

  constructor(tiles: readonly Tile[], rng: () => number = Math.random) {
    this.rng = rng
    this.tiles = shuffle([...tiles], rng)
  }

  draw(): Tile | null {
    return this.tiles.pop() ?? null
  }

  get remaining(): number {
    return this.tiles.length
  }

  get isEmpty(): boolean {
    return this.tiles.length === 0
  }
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
