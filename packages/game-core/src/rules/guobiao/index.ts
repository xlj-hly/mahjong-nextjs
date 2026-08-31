// 国标麻将规则插件：组装 RulesPlugin 实现。

import {
  countTiles,
  isNumberSuit,
  tileKey,
  type Suit,
  type Tile,
} from '../../core/tile'
import type {
  ActionContext,
  HandState,
  KongOption,
  RulesPlugin,
  ScoreContext,
  ScoreResult,
  WinContext,
  WinningInfo,
} from '../../core/rules-plugin'
import { buildWall } from './tile-set'
import { calcScore, evaluateWin } from './evaluate'

export const guobiao: RulesPlugin = {
  id: 'guobiao',

  buildWall,

  isFlower: (tile) => tile.suit === 'flower',

  legalChow(ctx: ActionContext): [Tile, Tile][] {
    const { hand, discard } = ctx
    if (!discard || !isNumberSuit(discard.suit)) return []
    const counts = countTiles(hand.concealed)
    const suit = discard.suit
    const r = discard.rank
    const results: [Tile, Tile][] = []

    // 弃牌 r 与手牌两张组成顺子：r 可为最小/中间/最大。
    const candidates: [number, number][] = [
      [r + 1, r + 2], // r 最小
      [r - 1, r + 1], // r 中间
      [r - 2, r - 1], // r 最大
    ]
    for (const [a, b] of candidates) {
      if (a < 1 || a > 9 || b < 1 || b > 9) continue
      if (
        (counts.get(`${suit}${a}`) ?? 0) > 0 &&
        (counts.get(`${suit}${b}`) ?? 0) > 0
      ) {
        results.push([
          { suit, rank: a },
          { suit, rank: b },
        ])
      }
    }
    return results
  },

  canPong(ctx: ActionContext): boolean {
    const { hand, discard } = ctx
    if (!discard) return false
    return (countTiles(hand.concealed).get(tileKey(discard)) ?? 0) >= 2
  },

  kongOptions(ctx: ActionContext): KongOption[] {
    const { hand, discard } = ctx
    const options: KongOption[] = []
    const counts = countTiles(hand.concealed)

    if (discard) {
      // 明杠：手牌有三张相同
      if ((counts.get(tileKey(discard)) ?? 0) >= 3) {
        options.push({ kind: 'melded', tile: discard })
      }
    } else {
      // 暗杠：手牌有四张相同
      for (const [key, c] of counts) {
        if (c >= 4) {
          const [suit, rank] = parseKey(key)
          options.push({ kind: 'concealed', tile: { suit, rank } })
        }
      }
      // 补杠：已有碰出的刻子，手牌又摸到第四张
      for (const meld of hand.melds) {
        if (meld.type === 'pung') {
          if ((counts.get(tileKey(meld.tile)) ?? 0) >= 1) {
            options.push({ kind: 'added', tile: meld.tile })
          }
        }
      }
    }
    return options
  },

  evaluateWin(hand: HandState, ctx: WinContext): WinningInfo | null {
    return evaluateWin(hand, ctx)
  },

  calcScore(win: WinningInfo, ctx: ScoreContext): ScoreResult {
    return calcScore(win, ctx)
  },
}

function parseKey(key: string): [Suit, number] {
  const match = /^([a-z]+)(\d+)$/.exec(key)
  return [match?.[1] as Suit, Number(match?.[2] ?? 0)]
}

export type { WinningInfo }
