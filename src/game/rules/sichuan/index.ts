// 四川麻将规则插件：组装 RulesPlugin 实现。

import { countTiles, tileKey, type Suit } from '../../core/tile'
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

export const sichuan: RulesPlugin = {
  id: 'sichuan',

  buildWall,

  isFlower: () => false,

  requiresVoidSuit: true,

  legalChow: () => [],

  canPong(ctx: ActionContext): boolean {
    const { hand, discard, voidedSuit } = ctx
    if (!discard) return false
    // 缺门牌不可碰。
    if (voidedSuit && discard.suit === voidedSuit) return false
    return (countTiles(hand.concealed).get(tileKey(discard)) ?? 0) >= 2
  },

  kongOptions(ctx: ActionContext): KongOption[] {
    const { hand, discard, voidedSuit } = ctx
    const options: KongOption[] = []
    const counts = countTiles(hand.concealed)

    if (discard) {
      // 明杠：手牌有三张相同，且非缺门牌。
      if (
        (!voidedSuit || discard.suit !== voidedSuit) &&
        (counts.get(tileKey(discard)) ?? 0) >= 3
      ) {
        options.push({ kind: 'melded', tile: discard })
      }
    } else {
      // 暗杠：手牌有四张相同（排除缺门牌）。
      for (const [key, c] of counts) {
        if (c < 4) continue
        const [suit, rank] = parseKey(key)
        if (voidedSuit && suit === voidedSuit) continue
        options.push({ kind: 'concealed', tile: { suit, rank } })
      }
      // 补杠：已有碰出的刻子，手牌又摸到第四张（排除缺门牌）。
      for (const meld of hand.melds) {
        if (meld.type !== 'pung') continue
        if (voidedSuit && meld.tile.suit === voidedSuit) continue
        if ((counts.get(tileKey(meld.tile)) ?? 0) >= 1) {
          options.push({ kind: 'added', tile: meld.tile })
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
