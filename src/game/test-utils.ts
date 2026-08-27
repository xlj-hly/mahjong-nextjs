// 测试共享工具：牌型解析、和牌上下文、手牌/副露构造。
// 注：文件名不含 .test，vitest 不会当作测试运行。

import type { Tile } from './core/tile'
import type { Decomposition, Meld } from './core/decompose'
import type { HandState, WinContext } from './core/rules-plugin'

// 解析紧凑牌型字符串：1m=一万 … 9s=九条，1z=东 4z=北，1d=中 3d=白，1f=春 … 8f=菊。
export function tiles(spec: string): Tile[] {
  const suitMap: Record<string, Tile['suit']> = {
    m: 'wan',
    p: 'tong',
    s: 'tiao',
    z: 'wind',
    d: 'dragon',
    f: 'flower',
  }
  const result: Tile[] = []
  for (let i = 0; i < spec.length; i += 2) {
    result.push({ suit: suitMap[spec[i + 1]], rank: Number(spec[i]) })
  }
  return result
}

export function ctx(overrides: Partial<WinContext> = {}): WinContext {
  return {
    seat: 0,
    winTile: { suit: 'wan', rank: 1 },
    isSelfDraw: false,
    isDealer: false,
    seatWind: 1,
    roundWind: 1,
    isLastTile: false,
    isKongReplacement: false,
    isRobbingKong: false,
    visibleCount: 0,
    ...overrides,
  }
}

export function hand(
  concealed: Tile[],
  overrides: Partial<HandState> = {},
): HandState {
  return { concealed, flowers: [], melds: [], ...overrides }
}

export function pung(tile: Tile, concealed = false): Meld {
  return { type: 'pung', tile, concealed }
}

export function kong(tile: Tile, concealed: boolean): Meld {
  return { type: 'kong', tile, concealed }
}

export function chow(a: Tile, b: Tile, c: Tile, concealed = false): Meld {
  return { type: 'chow', tiles: [a, b, c], concealed }
}

export type { Decomposition, Meld }
