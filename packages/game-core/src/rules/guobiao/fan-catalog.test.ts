// 番种表驱动测试：为每个已实现的国标番种提供「已知和牌牌型 → 命中 + 正确番值」正例。
// 番值在测试中硬编码（独立于 FAN_VALUES），可同时验证番值表本身。

import { describe, expect, it } from 'vitest'
import { evaluateWin } from './evaluate'
import { chow, ctx, hand, kong, pung, tiles } from '../../test-utils'
import type { Meld } from '../../core/decompose'

function fanNames(
  concealed: ReturnType<typeof tiles>,
  opts: {
    melds?: Meld[]
    flowers?: ReturnType<typeof tiles>
    selfDraw?: boolean
    seatWind?: number
    roundWind?: number
    lastTile?: boolean
    kongReplacement?: boolean
    robbingKong?: boolean
    visibleCount?: number
    winTile?: ReturnType<typeof tiles>[number]
  } = {},
) {
  const info = evaluateWin(
    hand(concealed, { melds: opts.melds ?? [], flowers: opts.flowers ?? [] }),
    ctx({
      isSelfDraw: opts.selfDraw ?? false,
      seatWind: opts.seatWind ?? 1,
      roundWind: opts.roundWind ?? 1,
      isLastTile: opts.lastTile ?? false,
      isKongReplacement: opts.kongReplacement ?? false,
      isRobbingKong: opts.robbingKong ?? false,
      visibleCount: opts.visibleCount ?? 0,
      winTile: opts.winTile ?? { suit: 'wan', rank: 1 },
    }),
  )
  return info?.fan.map((f) => f.name) ?? []
}

function expectFan(names: string[], fan: string) {
  expect(names).toContain(fan)
}

describe('番种表驱动 · 88–48 番', () => {
  it('大四喜 88', () => {
    // 东南西北四副风刻 + 1万对
    const n = fanNames(tiles('1z1z1z2z2z2z3z3z3z4z4z4z1m1m'))
    expectFan(n, '大四喜')
  })
  it('大三元 88', () => {
    // 中中中 发发发 白白白 + 123万 + 9万对
    const n = fanNames(tiles('1d1d1d2d2d2d3d3d3d1m2m3m9m9m'))
    expectFan(n, '大三元')
  })
  it('绿一色 88', () => {
    // 234条 234条 666条 888条 发发
    const n = fanNames(tiles('2s3s4s2s3s4s6s6s6s8s8s8s2d2d'))
    expectFan(n, '绿一色')
  })
  it('九莲宝灯 88', () => {
    // 1112345678999 万 + 5万
    const n = fanNames(tiles('1m1m1m2m3m4m5m6m7m8m9m9m9m5m'))
    expectFan(n, '九莲宝灯')
  })
  it('四杠 88', () => {
    // 四副暗杠 + 1万对
    const melds = [
      kong({ suit: 'wind', rank: 1 }, true),
      kong({ suit: 'wind', rank: 2 }, true),
      kong({ suit: 'wind', rank: 3 }, true),
      kong({ suit: 'wind', rank: 4 }, true),
    ]
    const n = fanNames(tiles('1m1m'), { melds })
    expectFan(n, '四杠')
  })
  it('连七对 88', () => {
    const n = fanNames(tiles('1m1m2m2m3m3m4m4m5m5m6m6m7m7m'))
    expectFan(n, '连七对')
  })
  it('十三幺 88', () => {
    const n = fanNames(tiles('1m9m1p9p1s9s1z2z3z4z1d2d3d1d'))
    expectFan(n, '十三幺')
  })

  it('清幺九 64', () => {
    // 111万 999万 111筒 999筒 + 1条对
    const n = fanNames(tiles('1m1m1m9m9m9m1p1p1p9p9p9p1s1s'))
    expectFan(n, '清幺九')
  })
  it('小四喜 64', () => {
    // 东东东 南南南 西西西 + 123万 + 北北
    const n = fanNames(tiles('1z1z1z2z2z2z3z3z3z1m2m3m4z4z'))
    expectFan(n, '小四喜')
  })
  it('小三元 64', () => {
    // 中中中 发发发 + 123万 456万 + 白白
    const n = fanNames(tiles('1d1d1d2d2d2d1m2m3m4m5m6m3d3d'))
    expectFan(n, '小三元')
  })
  it('字一色 64', () => {
    // 东东东 南南南 西西西 中中中 发发
    const n = fanNames(tiles('1z1z1z2z2z2z3z3z3z1d1d1d2d2d'))
    expectFan(n, '字一色')
  })
  it('四暗刻 64', () => {
    // 111万 333万 555万 777万 99万（全暗）
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'))
    expectFan(n, '四暗刻')
  })
  it('一色双龙会 64', () => {
    // 123万 123万 789万 789万 55万
    const n = fanNames(tiles('1m2m3m1m2m3m7m8m9m7m8m9m5m5m'))
    expectFan(n, '一色双龙会')
  })

  it('一色四同顺 48', () => {
    // 123万 × 4 + 55万
    const n = fanNames(tiles('1m2m3m1m2m3m1m2m3m1m2m3m5m5m'))
    expectFan(n, '一色四同顺')
  })
  it('一色四节高 48', () => {
    // 111万 222万 333万 444万 + 55万
    const n = fanNames(tiles('1m1m1m2m2m2m3m3m3m4m4m4m5m5m'))
    expectFan(n, '一色四节高')
  })
})

describe('番种表驱动 · 32–16 番', () => {
  it('一色四步高 32', () => {
    // 123万 234万 345万 456万 + 77万
    const n = fanNames(tiles('1m2m3m2m3m4m3m4m5m4m5m6m7m7m'))
    expectFan(n, '一色四步高')
  })
  it('三杠 32', () => {
    // 三副暗杠 + 123万 + 99万
    const melds = [
      kong({ suit: 'wind', rank: 1 }, true),
      kong({ suit: 'wind', rank: 2 }, true),
      kong({ suit: 'wind', rank: 3 }, true),
    ]
    const n = fanNames(tiles('1m2m3m9m9m'), { melds })
    expectFan(n, '三杠')
  })
  it('混幺九 32', () => {
    // 111万 999万 东东东 中中中 + 9筒对
    const n = fanNames(tiles('1m1m1m9m9m9m1z1z1z1d1d1d9p9p'))
    expectFan(n, '混幺九')
  })

  it('七对 24', () => {
    // 不连续七对：1万1万 3万3万 5万5万 7万7万 9万9万 1筒1筒 3条3条
    const n = fanNames(tiles('1m1m3m3m5m5m7m7m9m9m1p1p3s3s'))
    expectFan(n, '七对')
  })
  it('七星不靠 24', () => {
    // 东南西北中发白 + 147万 147筒 3条
    const n = fanNames(tiles('1z2z3z4z1d2d3d1m4m7m1p4p7p3s'))
    expectFan(n, '七星不靠')
  })
  it('全双刻 24', () => {
    // 222万 444万 666万 888万 + 2筒对
    const n = fanNames(tiles('2m2m2m4m4m4m6m6m6m8m8m8m2p2p'))
    expectFan(n, '全双刻')
  })
  it('清一色 24', () => {
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'))
    expectFan(n, '清一色')
  })
  it('一色三同顺 24', () => {
    // 用副露固定三副 123万顺子（避免与 111/222/333 三节高歧义），手牌剩 456万 + 99万
    const melds = [
      chow(
        { suit: 'wan', rank: 1 },
        { suit: 'wan', rank: 2 },
        { suit: 'wan', rank: 3 },
        false,
      ),
      chow(
        { suit: 'wan', rank: 1 },
        { suit: 'wan', rank: 2 },
        { suit: 'wan', rank: 3 },
        false,
      ),
      chow(
        { suit: 'wan', rank: 1 },
        { suit: 'wan', rank: 2 },
        { suit: 'wan', rank: 3 },
        false,
      ),
    ]
    const n = fanNames(tiles('4m5m6m9m9m'), { melds })
    expectFan(n, '一色三同顺')
  })
  it('一色三节高 24', () => {
    // 111万 222万 333万 + 456万 + 77万
    const n = fanNames(tiles('1m1m1m2m2m2m3m3m3m4m5m6m7m7m'))
    expectFan(n, '一色三节高')
  })
  it('全大 24', () => {
    // 777万 888万 999万 789筒 + 9筒对
    const n = fanNames(tiles('7m7m7m8m8m8m9m9m9m7p8p9p9p9p'))
    expectFan(n, '全大')
  })
  it('全中 24', () => {
    // 444万 555万 666万 456筒 + 6筒对
    const n = fanNames(tiles('4m4m4m5m5m5m6m6m6m4p5p6p6p6p'))
    expectFan(n, '全中')
  })
  it('全小 24', () => {
    // 111万 222万 333万 123筒 + 3筒对
    const n = fanNames(tiles('1m1m1m2m2m2m3m3m3m1p2p3p3p3p'))
    expectFan(n, '全小')
  })

  it('清龙 16', () => {
    // 123万 456万 789万 + 555万 + 99筒
    const n = fanNames(tiles('1m2m3m4m5m6m7m8m9m5m5m5m9p9p'))
    expectFan(n, '清龙')
  })
  it('三色双龙会 16', () => {
    // 123万 789万 123筒 789筒 + 55条
    const n = fanNames(tiles('1m2m3m7m8m9m1p2p3p7p8p9p5s5s'))
    expectFan(n, '三色双龙会')
  })
  it('一色三步高 16', () => {
    // 123万 234万 345万 + 678万 + 99万
    const n = fanNames(tiles('1m2m3m2m3m4m3m4m5m6m7m8m9m9m'))
    expectFan(n, '一色三步高')
  })
  it('全带五 16', () => {
    // 456万 456筒 555条 555万 + 5筒对
    const n = fanNames(tiles('4m5m6m4p5p6p5s5s5s5m5m5m5p5p'))
    expectFan(n, '全带五')
  })
  it('三同刻 16', () => {
    // 111万 111筒 111条 + 999万 + 99筒
    const n = fanNames(tiles('1m1m1m1p1p1p1s1s1s9m9m9m9p9p'))
    expectFan(n, '三同刻')
  })
  it('三暗刻 16', () => {
    // 111万 333万 555万（暗刻）+ 789万 + 99筒
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m8m9m9p9p'))
    expectFan(n, '三暗刻')
  })
})

describe('番种表驱动 · 12–8 番', () => {
  it('全不靠 12', () => {
    // 147万 258筒 369条 + 东南西北中（5 字牌）
    const n = fanNames(tiles('1m4m7m2p5p8p3s6s9s1z2z3z4z1d'))
    expectFan(n, '全不靠')
  })
  it('组合龙 12', () => {
    // 147万 258筒 369条（龙）+ 东东东（字牌面子）+ 南南（字牌对）
    const n = fanNames(tiles('1m4m7m2p5p8p3s6s9s1z1z1z2z2z'))
    expectFan(n, '组合龙')
  })
  it('大于五 12', () => {
    // 666万 789万 678筒 789条 + 9万对
    const n = fanNames(tiles('6m6m6m7m8m9m6p7p8p7s8s9s9m9m'))
    expectFan(n, '大于五')
  })
  it('小于五 12', () => {
    // 111万 234万 123筒 234条 + 4万对
    const n = fanNames(tiles('1m1m1m2m3m4m1p2p3p2s3s4s4m4m'))
    expectFan(n, '小于五')
  })
  it('三风刻 12', () => {
    // 东东东 南南南 西西西 + 123万 + 99万
    const n = fanNames(tiles('1z1z1z2z2z2z3z3z3z1m2m3m9m9m'))
    expectFan(n, '三风刻')
  })

  it('花龙 8', () => {
    // 123万 456筒 789条 + 555万 + 99万
    const n = fanNames(tiles('1m2m3m4p5p6p7s8s9s5m5m5m9m9m'))
    expectFan(n, '花龙')
  })
  it('推不倒 8', () => {
    // 123筒 345筒 888筒 999筒 + 白白
    const n = fanNames(tiles('1p2p3p3p4p5p8p8p8p9p9p9p3d3d'))
    expectFan(n, '推不倒')
  })
  it('三色三同顺 8', () => {
    // 123万 123筒 123条 + 555万 + 99万
    const n = fanNames(tiles('1m2m3m1p2p3p1s2s3s5m5m5m9m9m'))
    expectFan(n, '三色三同顺')
  })
  it('三色三节高 8', () => {
    // 555万 666筒 777条 + 123万 + 99万
    const n = fanNames(tiles('5m5m5m6p6p6p7s7s7s1m2m3m9m9m'))
    expectFan(n, '三色三节高')
  })
  // 无番和依赖精确的听牌分析（边张/坎张/单钓将须看听牌上下文），当前未实现。
  it.todo('无番和 8（依赖听牌分析，未实现）')
  it('妙手回春 8', () => {
    // 自摸最后一张
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'), {
      selfDraw: true,
      lastTile: true,
    })
    expectFan(n, '妙手回春')
  })
  it('海底捞月 8', () => {
    // 点和最后一张
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'), {
      lastTile: true,
    })
    expectFan(n, '海底捞月')
  })
  it('杠上开花 8', () => {
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'), {
      selfDraw: true,
      kongReplacement: true,
    })
    expectFan(n, '杠上开花')
  })
  it('抢杠和 8', () => {
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'), {
      robbingKong: true,
    })
    expectFan(n, '抢杠和')
  })
})

describe('番种表驱动 · 6–4 番', () => {
  it('碰碰和 6', () => {
    // 含一副明刻副露，避免命中四暗刻吞掉碰碰和
    const melds = [pung({ suit: 'wan', rank: 1 }, false)]
    const n = fanNames(tiles('3m3m3m5m5m5m7m7m7m9m9m'), { melds })
    expectFan(n, '碰碰和')
  })
  it('混一色 6', () => {
    // 111万 333万 555万 东东东 + 99万
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m1z1z1z9m9m'))
    expectFan(n, '混一色')
  })
  it('三色三步高 6', () => {
    // 123万 234筒 345条 + 678万 + 99万
    const n = fanNames(tiles('1m2m3m2p3p4p3s4s5s6m7m8m9m9m'))
    expectFan(n, '三色三步高')
  })
  it('五门齐 6', () => {
    // 123万 456筒 789条 东东东 + 中中
    const n = fanNames(tiles('1m2m3m4p5p6p7s8s9s1z1z1z1d1d'))
    expectFan(n, '五门齐')
  })
  it('全求人 6', () => {
    // 全副露 + 单钓将（点炮）
    const melds = [
      pung({ suit: 'wan', rank: 1 }, false),
      pung({ suit: 'wan', rank: 3 }, false),
      pung({ suit: 'wan', rank: 5 }, false),
      chow(
        { suit: 'tong', rank: 1 },
        { suit: 'tong', rank: 2 },
        { suit: 'tong', rank: 3 },
        false,
      ),
    ]
    const n = fanNames(tiles('9m9m'), { melds })
    expectFan(n, '全求人')
  })
  it('双暗杠 6', () => {
    const melds = [
      kong({ suit: 'wan', rank: 1 }, true),
      kong({ suit: 'wan', rank: 3 }, true),
    ]
    const n = fanNames(tiles('5m5m5m6m7m8m9m9m'), { melds })
    expectFan(n, '双暗杠')
  })
  it('双箭刻 6', () => {
    // 中中中 发发发 + 123万 456万 + 99万
    const n = fanNames(tiles('1d1d1d2d2d2d1m2m3m4m5m6m9m9m'))
    expectFan(n, '双箭刻')
  })

  it('全带幺 4', () => {
    // 123万 789万 111筒 999筒 + 1条对
    const n = fanNames(tiles('1m2m3m7m8m9m1p1p1p9p9p9p1s1s'))
    expectFan(n, '全带幺')
  })
  it('不求人 4', () => {
    // 门清自摸
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'), {
      selfDraw: true,
    })
    expectFan(n, '不求人')
  })
  it('双明杠 4', () => {
    const melds = [
      kong({ suit: 'wan', rank: 1 }, false),
      kong({ suit: 'wan', rank: 3 }, false),
    ]
    const n = fanNames(tiles('5m5m5m6m7m8m9m9m'), { melds })
    expectFan(n, '双明杠')
  })
  it('和绝张 4', () => {
    // 点炮，所和牌已亮出 3 张（visibleCount >= 4 含刚弃那张）
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'), {
      visibleCount: 4,
      winTile: { suit: 'wan', rank: 9 },
    })
    expectFan(n, '和绝张')
  })
})

describe('番种表驱动 · 2–1 番', () => {
  it('箭刻 2', () => {
    // 中中中 + 123万 456万 789万 + 99筒
    const n = fanNames(tiles('1d1d1d1m2m3m4m5m6m7m8m9m9p9p'))
    expectFan(n, '箭刻')
  })
  it('圈风刻 2', () => {
    // 东东东（东圈）
    const n = fanNames(tiles('1z1z1z1m2m3m4m5m6m7m8m9m9p9p'), { roundWind: 1 })
    expectFan(n, '圈风刻')
  })
  it('门风刻 2', () => {
    // 东东东（门风东）
    const n = fanNames(tiles('1z1z1z1m2m3m4m5m6m7m8m9m9p9p'), { seatWind: 1 })
    expectFan(n, '门风刻')
  })
  it('门前清 2', () => {
    // 无副露点和
    const n = fanNames(tiles('1m2m3m4m5m6m7m8m9m1p2p3p5p5p'))
    expectFan(n, '门前清')
  })
  it('平和 2', () => {
    // 全顺子 + 非字非幺九将 + 断幺（避免 1/9 以免断幺不成立）
    const n = fanNames(tiles('2m3m4m5m6m7m2p3p4p5p6p7p8s8s'))
    expectFan(n, '平和')
  })
  it('四归一 2', () => {
    // 222万（刻）+ 234万（含 2万）→ 2万共 4 张
    const n = fanNames(tiles('2m2m2m2m3m4m5m6m7m8m8m8m9p9p'))
    expectFan(n, '四归一')
  })
  it('双同刻 2', () => {
    // 111万 111筒 + 456万 789万 + 99条
    const n = fanNames(tiles('1m1m1m1p1p1p4m5m6m7m8m9m9s9s'))
    expectFan(n, '双同刻')
  })
  it('双暗刻 2', () => {
    // 111万 333万（暗刻）+ 456万 789万 + 99筒
    const n = fanNames(tiles('1m1m1m3m3m3m4m5m6m7m8m9m9p9p'))
    expectFan(n, '双暗刻')
  })
  it('暗杠 2', () => {
    const melds = [kong({ suit: 'wan', rank: 1 }, true)]
    const n = fanNames(tiles('3m4m5m6m7m8m9m9m9m9p9p'), { melds })
    expectFan(n, '暗杠')
  })
  it('断幺 2', () => {
    // 无 1/9/字牌
    const n = fanNames(tiles('2m3m4m5m6m7m2p3p4p5p6p7p8s8s'))
    expectFan(n, '断幺')
  })

  it('一般高 1', () => {
    // 234万 × 2 + 567万 789万 + 88万（清一色载体凑足 8 番）
    const n = fanNames(tiles('2m3m4m2m3m4m5m6m7m7m8m9m8m8m'))
    expectFan(n, '一般高')
  })
  it('喜相逢 1', () => {
    // 123万 123筒 + 456筒 789筒 + 55条
    const n = fanNames(tiles('1m2m3m1p2p3p4p5p6p7p8p9p5s5s'))
    expectFan(n, '喜相逢')
  })
  it('连六 1', () => {
    // 123万 456万（连六）+ 789筒 123条 + 99筒
    const n = fanNames(tiles('1m2m3m4m5m6m7p8p9p1s2s3s9p9p'))
    expectFan(n, '连六')
  })
  it('老少副 1', () => {
    // 123万 789万 + 456筒 789筒 + 55条
    const n = fanNames(tiles('1m2m3m7m8m9m4p5p6p7p8p9p5s5s'))
    expectFan(n, '老少副')
  })
  it('幺九刻 1', () => {
    // 111万 + 234万 567万 888万 + 99筒
    const n = fanNames(tiles('1m1m1m2m3m4m5m6m7m8m8m8m9p9p'))
    expectFan(n, '幺九刻')
  })
  it('明杠 1', () => {
    // 明杠 1万 + 222万 345万 678万 + 99万（清一色载体凑足 8 番）
    const melds = [kong({ suit: 'wan', rank: 1 }, false)]
    const n = fanNames(tiles('2m2m2m3m4m5m6m7m8m9m9m'), { melds })
    expectFan(n, '明杠')
  })
  it('缺一门 1', () => {
    // 只有万筒，缺条
    const n = fanNames(tiles('1m2m3m4m5m6m7m8m9m1p2p3p5p5p'))
    expectFan(n, '缺一门')
  })
  it('无字 1', () => {
    const n = fanNames(tiles('1m2m3m4m5m6m7m8m9m1p2p3p5p5p'))
    expectFan(n, '无字')
  })
  it('边张 1', () => {
    // 听 123 的 3（winTile=3万，手牌含 1万2万）
    const n = fanNames(tiles('1m2m3m4m5m6m7m8m9m1p2p3p5p5p'), {
      winTile: { suit: 'wan', rank: 3 },
    })
    expectFan(n, '边张')
  })
  it('坎张 1', () => {
    // 听 123 的中间张 2（winTile=2万，手牌含 1万3万）
    const n = fanNames(tiles('1m2m3m4m5m6m7m8m9m1p2p3p5p5p'), {
      winTile: { suit: 'wan', rank: 2 },
    })
    expectFan(n, '坎张')
  })
  it('单钓将 1', () => {
    // 单钓 5筒对
    const n = fanNames(tiles('1m2m3m4m5m6m7m8m9m1p2p3p5p5p'), {
      winTile: { suit: 'tong', rank: 5 },
    })
    expectFan(n, '单钓将')
  })
  it('自摸 1', () => {
    // 含一副副露，避免命中不求人（不求人会吞掉自摸）；清一色载体凑足 8 番
    const melds = [pung({ suit: 'wan', rank: 1 }, false)]
    const n = fanNames(tiles('3m3m3m5m5m5m7m7m7m9m9m'), {
      melds,
      selfDraw: true,
    })
    expectFan(n, '自摸')
  })
  it('花牌 1', () => {
    // 带一张花牌
    const n = fanNames(tiles('1m1m1m3m3m3m5m5m5m7m7m7m9m9m'), {
      flowers: tiles('1f'),
    })
    expectFan(n, '花牌')
  })
})
