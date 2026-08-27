import { describe, expect, it } from 'vitest'
import { buildTileSet } from './tile-set'
import { evaluateWin } from './evaluate'
import { guobiao } from './index'
import type { Tile } from '../../core/tile'
import type { HandState, WinContext } from '../../core/rules-plugin'

function tiles(spec: string): Tile[] {
  const suitMap: Record<string, Tile['suit']> = {
    m: 'wan',
    p: 'tong',
    s: 'tiao',
    z: 'wind',
    d: 'dragon',
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
    ...overrides,
  }
}

function hand(
  concealed: Tile[],
  overrides: Partial<HandState> = {},
): HandState {
  return { concealed, flowers: [], melds: [], ...overrides }
}

describe('国标牌种集合', () => {
  it('共 144 张，其中花牌 8 张', () => {
    const set = buildTileSet()
    expect(set.length).toBe(144)
    expect(set.filter((t) => t.suit === 'flower').length).toBe(8)
  })

  it('牌墙共 144 张', () => {
    expect(guobiao.buildWall(() => 0).remaining).toBe(144)
  })
})

describe('国标和牌判定', () => {
  it('标准牌型：清一色 + 碰碰和', () => {
    // 清一色（万）+ 碰碰和：副露碰 1万 + 333 555 777 99（含副露避免命中四暗刻）
    const concealed = tiles('3m3m3m5m5m5m7m7m7m9m9m')
    const info = evaluateWin(
      hand(concealed, {
        melds: [
          { type: 'pung', tile: { suit: 'wan', rank: 1 }, concealed: false },
        ],
      }),
      ctx({ winTile: { suit: 'wan', rank: 9 } }),
    )
    expect(info).not.toBeNull()
    const names = info!.fan.map((f) => f.name)
    expect(names).toContain('清一色')
    expect(names).toContain('碰碰和')
    expect(info!.totalFan).toBeGreaterThanOrEqual(24 + 6)
  })

  it('特殊牌型：十三幺', () => {
    // 十三幺：1m9m1p9p1s9s 东南西北 中发白 中
    const concealed = tiles('1m9m1p9p1s9s1z2z3z4z1d2d3d1d')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'dragon', rank: 1 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.specialHand).toBe('十三幺')
    expect(info!.totalFan).toBe(88)
  })

  it('特殊牌型：连七对（88 番）', () => {
    // 连七对：1万-7万各两张，同花色 7 个连续点数
    const concealed = tiles('1m1m2m2m3m3m4m4m5m5m6m6m7m7m')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'wan', rank: 7 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.specialHand).toBe('连七对')
    expect(info!.totalFan).toBe(88)
  })

  it('三色三步高（6 番）：三种花色点数递增的三副顺子', () => {
    // 123万 234筒 345条 678万 99万
    const concealed = tiles('1m2m3m2p3p4p3s4s5s6m7m8m9m9m')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'wan', rank: 9 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('三色三步高')
  })

  it('三色三节高（8 番）：三种花色点数递增的三副刻子', () => {
    // 555万 666筒 777条 123万 99万
    const concealed = tiles('5m5m5m6p6p6p7s7s7s1m2m3m9m9m')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'wan', rank: 9 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('三色三节高')
  })

  it('三色三同顺（8 番）不应误判为三色三步高', () => {
    // 123万 123筒 123条 678万 99万
    const concealed = tiles('1m2m3m1p2p3p1s2s3s6m7m8m9m9m')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'wan', rank: 9 } }),
    )
    expect(info).not.toBeNull()
    const names = info!.fan.map((f) => f.name)
    expect(names).toContain('三色三同顺')
    expect(names).not.toContain('三色三步高')
  })

  it('暗杠不破门清：带暗杠的门清自摸应含不求人', () => {
    // 暗杠 1万 + 234万 567万 789万 + 99筒（自摸）
    const concealed = tiles('2m3m4m5m6m7m7m8m9m9p9p')
    const melds = [
      {
        type: 'kong' as const,
        tile: { suit: 'wan' as const, rank: 1 },
        concealed: true,
      },
    ]
    const info = evaluateWin(
      hand(concealed, { melds }),
      ctx({ isSelfDraw: true, winTile: { suit: 'tong', rank: 9 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('不求人')
  })

  it('杠可替代刻：三同刻应计入含杠的同点数刻子', () => {
    // 5万(杠) + 555筒 + 555条 + 888万 + 99筒 → 三同刻（万/筒/条同序数 5）
    const concealed = tiles('5p5p5p5s5s5s8m8m8m9p9p')
    const melds = [
      {
        type: 'kong' as const,
        tile: { suit: 'wan' as const, rank: 5 },
        concealed: true,
      },
    ]
    const info = evaluateWin(
      hand(concealed, { melds }),
      ctx({ isSelfDraw: true, winTile: { suit: 'tong', rank: 9 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.fan.map((f) => f.name)).toContain('三同刻')
  })

  it('含字牌对子的牌不应判为七星不靠', () => {
    // 东东 + 南西北中发白 + 147万 147筒 —— 含「东东」对子，非全部单张
    const concealed = tiles('1z1z2z3z4z1d2d3d1m4m7m1p4p7p')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'tong', rank: 7 } }),
    )
    // 不应被判为七星不靠；应走标准拆解或直接不可和
    if (info?.specialHand) {
      expect(info.specialHand).not.toBe('七星不靠')
      expect(info.specialHand).not.toBe('全不靠')
    }
  })

  it('标准全不靠/七星不靠（全部单张）仍可识别', () => {
    // 七星不靠：东南西北中发白（7字）+ 147万 147筒 3条（7 数牌，全部单张）
    const concealed = tiles('1z2z3z4z1d2d3d1m4m7m1p4p7p3s')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'tiao', rank: 3 } }),
    )
    expect(info).not.toBeNull()
    expect(info!.specialHand).toBe('七星不靠')
  })

  it('标准牌型无法拆解时不可和', () => {
    const concealed = tiles('1m2m3m4m5m6m7m8m9m1p2p3p4p5p')
    expect(evaluateWin(hand(concealed), ctx())).toBeNull()
  })
})

describe('不重复原则', () => {
  it('清一色与混一色只计清一色', () => {
    const concealed = tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'wan', rank: 9 } }),
    )
    const names = info!.fan.map((f) => f.name)
    expect(names).toContain('清一色')
    expect(names).not.toContain('混一色')
  })

  it('碰碰和与三同刻可叠加', () => {
    // 碰碰和 + 三同刻：副露碰 3万 + 3p3p3p 3s3s3s 5m5m5m 7p7p（含副露避免命中四暗刻）
    // 三色同点数刻（3）→ 三同刻（16）；全刻子 → 碰碰和（6）
    const concealed = tiles('3p3p3p3s3s3s5m5m5m7p7p')
    const info = evaluateWin(
      hand(concealed, {
        melds: [
          { type: 'pung', tile: { suit: 'wan', rank: 3 }, concealed: false },
        ],
      }),
      ctx({ winTile: { suit: 'tong', rank: 7 } }),
    )
    expect(info).not.toBeNull()
    const names = info!.fan.map((f) => f.name)
    expect(names).toContain('碰碰和')
    expect(names).toContain('三同刻')
  })
})

describe('8 番起胡门槛与花牌', () => {
  it('低番牌型不足 8 番不可和', () => {
    // 门前清（2）+ 无字（1）+ 单钓将（1）= 4 番，不足 8 番
    const concealed = tiles('1m2m3m2m3m4m4p5p6p5p6p7p9s9s')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'tiao', rank: 9 } }),
    )
    expect(info).toBeNull()
  })

  it('花牌每张 +1 番', () => {
    const concealed = tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m')
    const flowers = tiles('1f2f') // 两张花牌
    const noFlower = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'wan', rank: 9 } }),
    )!
    const withFlower = evaluateWin(
      hand(concealed, { flowers }),
      ctx({ winTile: { suit: 'wan', rank: 9 } }),
    )!
    expect(withFlower.totalFan).toBe(noFlower.totalFan + 2)
    expect(withFlower.fan.map((f) => f.name)).toContain('花牌')
  })
})

describe('结算', () => {
  it('自摸三家各付', () => {
    const concealed = tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m')
    const info = evaluateWin(
      hand(concealed),
      ctx({ isSelfDraw: true, winTile: { suit: 'wan', rank: 9 } }),
    )!
    const score = guobiao.calcScore(info, {
      seat: 0,
      isDealer: false,
      totalFan: info.totalFan,
      basePoints: 1,
      discarder: null,
    })
    expect(score.selfDraw).toBe(true)
    expect(score.payments).toHaveLength(3)
    for (const p of score.payments) {
      expect(p.points).toBe(info.totalFan)
    }
  })

  it('点炮仅点炮者付', () => {
    const concealed = tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m')
    const info = evaluateWin(
      hand(concealed),
      ctx({ winTile: { suit: 'wan', rank: 9 } }),
    )!
    const score = guobiao.calcScore(info, {
      seat: 0,
      isDealer: false,
      totalFan: info.totalFan,
      basePoints: 1,
      discarder: 2,
    })
    expect(score.selfDraw).toBe(false)
    expect(score.payments).toHaveLength(1)
    expect(score.payments[0]).toEqual({ from: 2, to: 0, points: info.totalFan })
  })
})

describe('吃碰杠合法性', () => {
  it('碰：手牌两张相同可碰', () => {
    const concealed = tiles('3m3m')
    expect(guobiao.canPong(concealed, { suit: 'wan', rank: 3 })).toBe(true)
    expect(guobiao.canPong(concealed, { suit: 'wan', rank: 4 })).toBe(false)
  })

  it('吃：只能吃上家同花色相邻牌', () => {
    const concealed = tiles('4m5m')
    const options = guobiao.legalChow(concealed, { suit: 'wan', rank: 3 })
    expect(options).toHaveLength(1)
    expect(options[0]).toContainEqual({ suit: 'wan', rank: 4 })
  })

  it('暗杠：手牌四张相同', () => {
    const concealed = tiles('7m7m7m7m')
    const opts = guobiao.kongOptions(hand(concealed), null)
    expect(opts.some((o) => o.kind === 'concealed' && o.tile.rank === 7)).toBe(
      true,
    )
  })
})
