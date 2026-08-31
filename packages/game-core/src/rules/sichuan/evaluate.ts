// 四川和牌判定与番种计算：复用拆解算法，番种为叠加制，含缺一门约束。

import { countTiles, isNumberSuit, type Tile } from '../../core/tile'
import { decompose, type Decomposition, type Meld } from '../../core/decompose'
import type {
  FanEntry,
  HandState,
  ScoreResult,
  WinContext,
  WinningInfo,
} from '../../core/rules-plugin'
import { FAN_VALUES, IMPLIES } from './fan'

// —— 番种判定 ——

interface Features {
  melds: Meld[]
  pair: [Tile, Tile]
  allTiles: Tile[]
  chows: Meld[]
  pungs: Meld[]
  kongs: Meld[]
  /** 单一花色（无副露时为纯手牌花色集合）。 */
  numberSuits: Set<string>
}

function meldTiles(meld: Meld): Tile[] {
  if (meld.type === 'chow') return [...meld.tiles]
  if (meld.type === 'pung') return [meld.tile, meld.tile, meld.tile]
  return [meld.tile, meld.tile, meld.tile, meld.tile]
}

function buildFeatures(
  hand: HandState,
  decomposition: Decomposition,
): Features {
  const melds: Meld[] = [...hand.melds, ...decomposition.melds]
  const pair = decomposition.pair
  const allTiles: Tile[] = [...pair]
  for (const m of melds) allTiles.push(...meldTiles(m))

  const chows = melds.filter((m) => m.type === 'chow')
  const pungs = melds.filter((m) => m.type === 'pung')
  const kongs = melds.filter((m) => m.type === 'kong')
  const numberSuits = new Set<string>()
  for (const t of allTiles) {
    if (isNumberSuit(t.suit)) numberSuits.add(t.suit)
  }

  return { melds, pair, allTiles, chows, pungs, kongs, numberSuits }
}

type Predicate = (f: Features, ctx: WinContext) => boolean

const PREDICATES: Record<string, Predicate> = {
  平胡: (f) => {
    // 平胡：标准 4 面子 + 1 对（非对对胡、非清一色）。
    return f.pungs.length + f.kongs.length < 4
  },
  对对胡: (f) => f.pungs.length + f.kongs.length === 4,
  清一色: (f) => f.numberSuits.size === 1,
  七对: () => false, // 特殊和型，单独判定
  龙七对: () => false, // 特殊和型，单独判定
  杠上花: (f, ctx) => ctx.isKongReplacement,
  杠上炮: (f, ctx) => !ctx.isSelfDraw && ctx.isKongReplacement,
  抢杠胡: (f, ctx) => ctx.isRobbingKong,
  海底捞月: (f, ctx) => ctx.isLastTile,
}

// —— 特殊和型：七对 / 龙七对 ——

function specialHandType(hand: HandState): string | null {
  if (hand.melds.length > 0) return null
  const tiles = hand.concealed
  if (tiles.length !== 14) return null
  const counts = countTiles(tiles)
  let pairs = 0
  let hasQuad = false
  for (const c of counts.values()) {
    if (c === 2) pairs++
    else if (c === 4) {
      pairs += 2 // 四张算作两对
      hasQuad = true
    } else if (c !== 0) return null
  }
  if (pairs !== 7) return null
  return hasQuad ? '龙七对' : '七对'
}

// —— 主入口 ——

export function evaluateWin(
  hand: HandState,
  ctx: WinContext,
): WinningInfo | null {
  // 缺一门约束：手牌不得含缺门牌。
  if (ctx.voidedSuit) {
    const hasVoided = [
      ...hand.concealed,
      ...hand.melds.flatMap(meldTiles),
    ].some((t) => t.suit === ctx.voidedSuit)
    if (hasVoided) return null
  }

  const special = specialHandType(hand)
  if (special) {
    const fan: FanEntry[] = [{ name: special, value: FAN_VALUES[special] }]
    // 清七对 = 清一色 + 七对；清龙七对 = 清一色 + 龙七对。
    const suits = new Set(hand.concealed.map((t) => t.suit))
    if (suits.size === 1)
      fan.push({ name: '清一色', value: FAN_VALUES['清一色'] })
    return {
      fan,
      totalFan: sumFan(fan),
      decomposition: null,
      specialHand: special,
    }
  }

  const meldCount = 4 - hand.melds.length
  const decomps = decompose(hand.concealed, meldCount)
  if (decomps.length === 0) return null

  let best: WinningInfo | null = null
  for (const decomposition of decomps) {
    const features = buildFeatures(hand, decomposition)
    const matched = new Map<string, number>()
    for (const [name, pred] of Object.entries(PREDICATES)) {
      if (pred(features, ctx)) matched.set(name, FAN_VALUES[name])
    }

    const fan = resolveFan(matched)
    const totalFan = sumFan(fan)
    if (!best || totalFan > best.totalFan) {
      best = { fan, totalFan, decomposition }
    }
  }

  return best
}

function resolveFan(matched: Map<string, number>): FanEntry[] {
  const excluded = new Set<string>()
  for (const [higher, lowers] of Object.entries(IMPLIES)) {
    if (!matched.has(higher)) continue
    for (const lower of lowers) {
      if (matched.has(lower)) excluded.add(lower)
    }
  }
  const result: FanEntry[] = []
  for (const [name, value] of matched) {
    if (excluded.has(name)) continue
    result.push({ name, value })
  }
  result.sort((a, b) => b.value - a.value)
  return result
}

function sumFan(fan: FanEntry[]): number {
  return fan.reduce((sum, f) => sum + f.value, 0)
}

// —— 结算 ——

export function calcScore(
  win: WinningInfo,
  ctx: {
    seat: number
    isDealer: boolean
    totalFan: number
    basePoints: number
    discarder: number | null
  },
): ScoreResult {
  const points = ctx.basePoints * ctx.totalFan
  const payments: ScoreResult['payments'] = []
  const winner = ctx.seat as ScoreResult['winner']
  const selfDraw = ctx.discarder === null

  if (selfDraw) {
    for (let s = 0; s < 4; s++) {
      if (s !== winner) payments.push({ from: s as never, to: winner, points })
    }
  } else if (ctx.discarder !== null && ctx.discarder !== winner) {
    payments.push({ from: ctx.discarder as never, to: winner, points })
  }

  return { winner, selfDraw, totalFan: ctx.totalFan, payments }
}
