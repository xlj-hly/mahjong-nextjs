import { describe, expect, it } from 'vitest'
import { buildTileSet } from './tile-set'
import { evaluateWin } from './evaluate'
import { sichuan } from './index'
import type { Tile } from '../../core/tile'
import type { HandState, WinContext } from '../../core/rules-plugin'

function tiles(spec: string): Tile[] {
  const suitMap: Record<string, Tile['suit']> = {
    m: 'wan',
    p: 'tong',
    s: 'tiao',
  }
  const result: Tile[] = []
  for (let i = 0; i < spec.length; i += 2) {
    result.push({ suit: suitMap[spec[i + 1]], rank: Number(spec[i]) })
  }
  return result
}

function ctx(overrides: Partial<WinContext> = {}): WinContext {
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
    voidedSuit: null,
    ...overrides,
  }
}

function hand(
  concealed: Tile[],
  overrides: Partial<HandState> = {},
): HandState {
  return { concealed, flowers: [], melds: [], ...overrides }
}

function actionCtx(
  concealed: Tile[],
  discard: Tile | null,
  voidedSuit: Tile['suit'] | null = null,
) {
  return {
    hand: hand(concealed),
    discard,
    seat: 0 as const,
    seatWind: 1,
    roundWind: 1,
    voidedSuit,
  }
}

describe('四川牌种集合', () => {
  it('共 108 张，无字无花', () => {
    const set = buildTileSet()
    expect(set.length).toBe(108)
    expect(
      set.some(
        (t) => t.suit === 'wind' || t.suit === 'dragon' || t.suit === 'flower',
      ),
    ).toBe(false)
  })

  it('牌墙共 108 张', () => {
    expect(sichuan.buildWall(() => 0).remaining).toBe(108)
  })
})

describe('四川插件骨架', () => {
  it('不能吃', () => {
    expect(
      sichuan.legalChow(actionCtx(tiles('4m5m'), { suit: 'wan', rank: 3 })),
    ).toHaveLength(0)
  })

  it('需要定缺', () => {
    expect(sichuan.requiresVoidSuit).toBe(true)
  })

  it('无花牌', () => {
    expect(sichuan.isFlower({ suit: 'wan', rank: 1 })).toBe(false)
  })
})

describe('缺一门约束', () => {
  it('含缺门牌不可和', () => {
    // 定缺万，手牌含万子
    const concealed = tiles('1m2m3m4p5p6p7p8p9p9s9s')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 9 } }),
    )
    expect(info).toBeNull()
  })

  it('不含缺门牌可和', () => {
    // 定缺万，手牌只含筒条
    const concealed = tiles('1p2p3p4p5p6p7p8p9p1s2s3s9s9s')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 9 } }),
    )
    expect(info).not.toBeNull()
  })

  it('缺门牌不可碰', () => {
    const concealed = tiles('3m3m')
    expect(
      sichuan.canPong(actionCtx(concealed, { suit: 'wan', rank: 3 }, 'wan')),
    ).toBe(false)
    expect(
      sichuan.canPong(actionCtx(concealed, { suit: 'wan', rank: 3 }, 'tong')),
    ).toBe(true)
  })

  it('缺门牌不可杠', () => {
    const concealed = tiles('7m7m7m')
    const opts = sichuan.kongOptions(
      actionCtx(concealed, { suit: 'wan', rank: 7 }, 'wan'),
    )
    expect(opts).toHaveLength(0)
  })

  it('缺门牌不可暗杠', () => {
    const concealed = tiles('7m7m7m7m')
    const opts = sichuan.kongOptions(actionCtx(concealed, null, 'wan'))
    expect(opts.some((o) => o.kind === 'concealed')).toBe(false)
  })

  it('非缺门牌可暗杠', () => {
    const concealed = tiles('7p7p7p7p')
    const opts = sichuan.kongOptions(actionCtx(concealed, null, 'wan'))
    expect(opts.some((o) => o.kind === 'concealed')).toBe(true)
  })
})

describe('四川番种', () => {
  it('清一色识别', () => {
    const concealed = tiles('1p1p1p3p3p3p5p5p5p7p7p7p9p9p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 9 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('清一色')
  })

  it('清七对 = 清一色 + 七对（叠加）', () => {
    // 筒 1-7 各两张 = 七对 + 清一色
    const concealed = tiles('1p1p2p2p3p3p4p4p5p5p6p6p7p7p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 7 } }),
    )
    expect(info).not.toBeNull()
    const names = info!.fan.map((f) => f.name)
    expect(names).toContain('七对')
    expect(names).toContain('清一色')
    expect(info!.totalFan).toBe(3 + 3)
  })

  it('平胡 1 番可和（无起胡门槛）', () => {
    // 平胡：4 面子 + 1 对，非对对胡非清一色；定缺万（不含万）
    const concealed = tiles('1p2p3p4p5p6p7p8p9p1s2s3s5s5s')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tiao', rank: 5 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('平胡')
  })

  it('对对胡识别', () => {
    const concealed = tiles('1p1p1p3p3p3p5p5p5p7p7p7p9p9p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 9 } }),
    )
    expect(info!.fan.map((f) => f.name)).toContain('对对胡')
  })

  it('龙七对识别', () => {
    // 一个四张（2 对）+ 5 个对子 = 7 对
    const concealed = tiles('1p1p1p1p2p2p3p3p4p4p5p5p6p6p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 6 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('龙七对')
  })

  it('龙七对不与七对叠加', () => {
    const concealed = tiles('1p1p1p1p2p2p3p3p4p4p5p5p6p6p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 6 } }),
    )
    const names = info!.fan.map((f) => f.name)
    expect(names).toContain('龙七对')
    expect(names).not.toContain('七对')
  })

  it('清龙七对 = 清一色 + 龙七对（叠加）', () => {
    const concealed = tiles('1p1p1p1p2p2p3p3p4p4p5p5p6p6p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 6 } }),
    )
    const names = info!.fan.map((f) => f.name)
    expect(names).toContain('龙七对')
    expect(names).toContain('清一色')
    expect(info!.totalFan).toBe(4 + 3) // 龙七对 4 番 + 清一色 3 番
  })

  it('清一色覆盖平胡', () => {
    // 清一色 + 4 顺子（非对对胡），平胡被清一色覆盖
    const concealed = tiles('1p2p3p1p2p3p4p5p6p7p8p9p5p5p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 5 } }),
    )
    expect(info).not.toBeNull()
    const names = info!.fan.map((f) => f.name)
    expect(names).toContain('清一色')
    expect(names).not.toContain('平胡')
  })

  it('杠上花（自摸杠后补牌）', () => {
    const concealed = tiles('1p1p1p3p3p3p5p5p5p7p7p7p9p9p')
    const info = evaluateWin(
      hand(concealed),
      ctx({
        voidedSuit: 'wan',
        isSelfDraw: true,
        isKongReplacement: true,
        winTile: { suit: 'tong', rank: 9 },
      }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('杠上花')
  })

  it('杠上炮（点炮杠后补牌）', () => {
    const concealed = tiles('1p1p1p3p3p3p5p5p5p7p7p7p9p9p')
    const info = evaluateWin(
      hand(concealed),
      ctx({
        voidedSuit: 'wan',
        isKongReplacement: true,
        winTile: { suit: 'tong', rank: 9 },
      }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('杠上炮')
  })

  it('抢杠胡', () => {
    const concealed = tiles('1p1p1p3p3p3p5p5p5p7p7p7p9p9p')
    const info = evaluateWin(
      hand(concealed),
      ctx({
        voidedSuit: 'wan',
        isRobbingKong: true,
        winTile: { suit: 'tong', rank: 9 },
      }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('抢杠胡')
  })

  it('海底捞月', () => {
    const concealed = tiles('1p1p1p3p3p3p5p5p5p7p7p7p9p9p')
    const info = evaluateWin(
      hand(concealed),
      ctx({
        voidedSuit: 'wan',
        isLastTile: true,
        winTile: { suit: 'tong', rank: 9 },
      }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('海底捞月')
  })
})

describe('结算', () => {
  it('自摸三家各付', () => {
    const concealed = tiles('1p1p1p3p3p3p5p5p5p7p7p7p9p9p')
    const info = evaluateWin(
      hand(concealed),
      ctx({
        voidedSuit: 'wan',
        isSelfDraw: true,
        winTile: { suit: 'tong', rank: 9 },
      }),
    )!
    const score = sichuan.calcScore(info, {
      seat: 0,
      isDealer: false,
      totalFan: info.totalFan,
      basePoints: 1,
      discarder: null,
    })
    expect(score.payments).toHaveLength(3)
    for (const p of score.payments) {
      expect(p.points).toBe(info.totalFan)
    }
  })

  it('点炮仅点炮者付', () => {
    const concealed = tiles('1p1p1p3p3p3p5p5p5p7p7p7p9p9p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ voidedSuit: 'wan', winTile: { suit: 'tong', rank: 9 } }),
    )!
    const score = sichuan.calcScore(info, {
      seat: 0,
      isDealer: false,
      totalFan: info.totalFan,
      basePoints: 1,
      discarder: 2,
    })
    expect(score.payments).toHaveLength(1)
    expect(score.payments[0]).toEqual({ from: 2, to: 0, points: info.totalFan })
  })
})
