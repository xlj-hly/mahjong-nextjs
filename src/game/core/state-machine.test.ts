import { describe, expect, it } from 'vitest'
import { Game } from './state-machine'
import { Wall } from './wall'
import type { Tile } from './tile'
import type { RulesPlugin, ScoreResult } from './rules-plugin'

// 最小 fake 插件：无花牌、无吃碰杠、永不可和，仅用于测试状态机的机械流转。
function fakePlugin(overrides: Partial<RulesPlugin> = {}): RulesPlugin {
  const tileSet: Tile[] = []
  for (let s = 0; s < 3; s++) {
    const suit = (['wan', 'tong', 'tiao'] as const)[s]
    for (let r = 1; r <= 9; r++) {
      for (let c = 0; c < 4; c++) tileSet.push({ suit, rank: r })
    }
  }
  return {
    id: 'fake',
    buildWall: (rng) => new Wall(tileSet, rng),
    isFlower: () => false,
    legalChow: () => [],
    canPong: () => false,
    kongOptions: () => [],
    evaluateWin: () => null,
    calcScore: (): ScoreResult => ({
      winner: 0,
      selfDraw: false,
      totalFan: 0,
      payments: [],
    }),
    ...overrides,
  }
}

describe('行牌状态机骨架', () => {
  it('发牌后庄家 14 张（含起手摸）、闲家 13 张', () => {
    const game = new Game(fakePlugin(), () => 0)
    const dealer = game.snapshot(0)
    expect(dealer.phase).toBe('draw')
    // 庄家起手 13 张，摸牌后进入 discard。
    game.apply(0, { type: 'draw' })
    const afterDraw = game.snapshot(0)
    expect(afterDraw.phase).toBe('discard')
    expect(afterDraw.hands[0].concealedCount).toBe(14)
    expect(afterDraw.hands[1].concealedCount).toBe(13)
    expect(afterDraw.hands[2].concealedCount).toBe(13)
    expect(afterDraw.hands[3].concealedCount).toBe(13)
  })

  it('出牌后无吃碰杠和，行动权流转到下家', () => {
    const game = new Game(fakePlugin(), () => 0)
    game.apply(0, { type: 'draw' })
    const hand = game.snapshot(0).hands[0].concealed!
    game.apply(0, { type: 'discard', tile: hand[0] })
    const snap = game.snapshot(1)
    expect(snap.phase).toBe('draw')
    expect(snap.current).toBe(1)
    expect(snap.legalActions).toEqual([{ type: 'draw' }])
  })

  it('非法操作被拒绝', () => {
    const game = new Game(fakePlugin(), () => 0)
    // 未轮到庄家前，闲家不能摸牌。
    expect(() => game.apply(1, { type: 'draw' })).toThrow()
  })

  it('其他玩家手牌隐藏，仅自己可见', () => {
    const game = new Game(fakePlugin(), () => 0)
    const snap = game.snapshot(0)
    expect(snap.hands[0].concealed).toBeDefined()
    expect(snap.hands[1].concealed).toBeUndefined()
    expect(snap.hands[1].concealedCount).toBe(13)
  })

  it('多玩家可碰同一张牌时，按顺序依次获得响应机会', () => {
    // 让所有玩家都能碰任意牌，验证 doPass 会依次轮询而非直接跳过。
    const game = new Game(fakePlugin({ canPong: () => true }), () => 0)
    game.apply(0, { type: 'draw' })
    const hand = game.snapshot(0).hands[0].concealed!
    game.apply(0, { type: 'discard', tile: hand[0] })

    // 座位 0 弃牌，座位 1、2、3 都能碰。优先级按离弃牌者近者排序：1 → 2 → 3。
    const snap1 = game.snapshot(1)
    expect(snap1.phase).toBe('claim')
    expect(snap1.activeClaimer).toBe(1)
    expect(snap1.legalActions.some((a) => a.type === 'pong')).toBe(true)

    // 座位 1 过 → 轮到座位 2
    game.apply(1, { type: 'pass' })
    const snap2 = game.snapshot(2)
    expect(snap2.activeClaimer).toBe(2)
    expect(snap2.legalActions.some((a) => a.type === 'pong')).toBe(true)

    // 座位 2 过 → 轮到座位 3
    game.apply(2, { type: 'pass' })
    const snap3 = game.snapshot(3)
    expect(snap3.activeClaimer).toBe(3)

    // 座位 3 过 → 队列耗尽，进入座位 1 摸牌
    game.apply(3, { type: 'pass' })
    const after = game.snapshot(1)
    expect(after.phase).toBe('draw')
    expect(after.current).toBe(1)
  })

  it('需定缺的规则：发牌后进入定缺阶段，依次定缺后进入行牌', () => {
    const game = new Game(fakePlugin({ requiresVoidSuit: true }), () => 0)
    // 发牌后处于定缺阶段，庄家先行定缺。
    const snap0 = game.snapshot(0)
    expect(snap0.phase).toBe('voidSuit')
    expect(snap0.current).toBe(0)
    expect(snap0.legalActions.map((a) => a.type)).toEqual([
      'voidSuit',
      'voidSuit',
      'voidSuit',
    ])

    // 依次定缺 0→1→2→3
    game.apply(0, { type: 'voidSuit', suit: 'wan' })
    expect(game.snapshot(1).current).toBe(1)
    expect(game.snapshot(1).phase).toBe('voidSuit')

    game.apply(1, { type: 'voidSuit', suit: 'tong' })
    expect(game.snapshot(2).current).toBe(2)

    game.apply(2, { type: 'voidSuit', suit: 'tiao' })
    expect(game.snapshot(3).current).toBe(3)

    // 最后一位定缺后进入行牌阶段，庄家摸牌。
    game.apply(3, { type: 'voidSuit', suit: 'wan' })
    const after = game.snapshot(0)
    expect(after.phase).toBe('draw')
    expect(after.current).toBe(0)
  })

  it('不需定缺的规则：发牌后直接进入行牌', () => {
    const game = new Game(fakePlugin(), () => 0)
    expect(game.snapshot(0).phase).toBe('draw')
  })

  it('只有下家能吃：非下家不提供吃动作', () => {
    // 让所有玩家都能碰，且都「能组成顺子」，验证非下家的 legalActions 不含 chow。
    const game = new Game(
      fakePlugin({
        canPong: () => true,
        legalChow: () => [
          [
            { suit: 'wan', rank: 1 },
            { suit: 'wan', rank: 2 },
          ],
        ],
      }),
      () => 0,
    )
    game.apply(0, { type: 'draw' })
    const hand = game.snapshot(0).hands[0].concealed!
    game.apply(0, { type: 'discard', tile: hand[0] })

    // 座位 1 是下家，可碰可吃。
    const snap1 = game.snapshot(1)
    expect(snap1.activeClaimer).toBe(1)
    expect(snap1.legalActions.some((a) => a.type === 'chow')).toBe(true)

    // 座位 1 过 → 座位 2（非下家），只能碰、不能吃。
    game.apply(1, { type: 'pass' })
    const snap2 = game.snapshot(2)
    expect(snap2.activeClaimer).toBe(2)
    expect(snap2.legalActions.some((a) => a.type === 'pong')).toBe(true)
    expect(snap2.legalActions.some((a) => a.type === 'chow')).toBe(false)
  })
})
