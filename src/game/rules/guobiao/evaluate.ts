// 国标和牌判定与番种计算：特征提取 + 81 番种匹配 + 不重复原则 + 结算。

import {
  countTiles,
  isNumberSuit,
  tileKey,
  tilesEqual,
  type Tile,
} from '../../core/tile'
import { decompose, type Decomposition, type Meld } from '../../core/decompose'
import type {
  FanEntry,
  HandState,
  ScoreResult,
  WinContext,
  WinningInfo,
} from '../../core/rules-plugin'
import { IMPLIES, MUTUALLY_EXCLUSIVE, FAN_VALUES, MIN_FAN } from './fan'

// —— 特征结构 ——

type PungInfo = { tile: Tile; concealed: boolean }
type KongInfo = { tile: Tile; concealed: boolean }
type ChowInfo = { tiles: [Tile, Tile, Tile]; concealed: boolean }

interface Features {
  /** 所有面子（副露 + 拆解出的隐藏面子）。 */
  melds: Meld[]
  pair: [Tile, Tile]
  /** 全部牌（含面子与将牌），用于花色/幺九判断。 */
  allTiles: Tile[]
  chows: ChowInfo[]
  pungs: PungInfo[]
  kongs: KongInfo[]
  exposedKongCount: number
  concealedKongCount: number
  concealedPungCount: number
  isConcealed: boolean
  numberSuits: Set<string>
  hasHonors: boolean
  hasTerminal: boolean
  flowerCount: number
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

  const chows: ChowInfo[] = melds
    .filter((m): m is Extract<Meld, { type: 'chow' }> => m.type === 'chow')
    .map((m) => ({ tiles: m.tiles, concealed: m.concealed }))
  const pungs: PungInfo[] = melds
    .filter((m): m is Extract<Meld, { type: 'pung' }> => m.type === 'pung')
    .map((m) => ({ tile: m.tile, concealed: m.concealed }))
  const kongs: KongInfo[] = melds
    .filter((m): m is Extract<Meld, { type: 'kong' }> => m.type === 'kong')
    .map((m) => ({ tile: m.tile, concealed: m.concealed }))

  const exposedKongCount = kongs.filter((k) => !k.concealed).length
  const concealedKongCount = kongs.filter((k) => k.concealed).length
  const concealedPungCount =
    pungs.filter((p) => p.concealed).length + concealedKongCount
  const isConcealed = melds.every((m) => m.concealed)

  const numberSuits = new Set<string>()
  let hasHonors = false
  let hasTerminal = false
  for (const t of allTiles) {
    if (isNumberSuit(t.suit)) {
      numberSuits.add(t.suit)
      if (t.rank === 1 || t.rank === 9) hasTerminal = true
    } else if (t.suit === 'wind' || t.suit === 'dragon') {
      hasHonors = true
    }
  }

  return {
    melds,
    pair,
    allTiles,
    chows,
    pungs,
    kongs,
    exposedKongCount,
    concealedKongCount,
    concealedPungCount,
    isConcealed,
    numberSuits,
    hasHonors,
    hasTerminal,
    flowerCount: hand.flowers.length,
  }
}

// —— 番种谓词 ——

type Predicate = (f: Features, ctx: WinContext) => boolean

// 同点数不同花色的刻子集合（数牌）。杠可替代刻，故含杠。
function pungRanksByNumber(f: Features): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>()
  for (const t of pungAndKongTiles(f)) {
    if (!isNumberSuit(t.suit)) continue
    if (!map.has(t.rank)) map.set(t.rank, new Set())
    map.get(t.rank)!.add(t.suit)
  }
  return map
}

function chowStarts(f: Features): Array<{ suit: string; rank: number }> {
  return f.chows.map((c) => ({ suit: c.tiles[0].suit, rank: c.tiles[0].rank }))
}

function allSameNumberSuit(f: Features): boolean {
  return f.numberSuits.size === 1 && !f.hasHonors
}

function isAllTerminalsOrHonors(tiles: Tile[]): boolean {
  return tiles.every((t) => {
    if (isNumberSuit(t.suit)) return t.rank === 1 || t.rank === 9
    return t.suit === 'wind' || t.suit === 'dragon'
  })
}

// 提取所有刻/杠的牌面（风/箭/数牌通用）
function pungAndKongTiles(f: Features): Tile[] {
  return [...f.pungs.map((p) => p.tile), ...f.kongs.map((k) => k.tile)]
}

const PREDICATES: Record<string, Predicate> = {
  // 88 番
  大四喜: (f) => {
    const windTiles = pungAndKongTiles(f).filter((t) => t.suit === 'wind')
    return new Set(windTiles.map((t) => t.rank)).size === 4
  },
  大三元: (f) => {
    const dragonTiles = pungAndKongTiles(f).filter((t) => t.suit === 'dragon')
    return new Set(dragonTiles.map((t) => t.rank)).size === 3
  },
  绿一色: (f) => {
    return f.allTiles.every((t) => {
      if (t.suit === 'tiao') return [2, 3, 4, 6, 8].includes(t.rank)
      if (t.suit === 'dragon') return t.rank === 2 // 发
      return false
    })
  },
  九莲宝灯: (f) => {
    if (!allSameNumberSuit(f)) return false
    const counts = countTiles(f.allTiles)
    const suit = [...f.numberSuits][0]
    for (let r = 1; r <= 9; r++) {
      if ((counts.get(`${suit}${r}`) ?? 0) < 1) return false
    }
    return (
      (counts.get(`${suit}1`) ?? 0) >= 3 && (counts.get(`${suit}9`) ?? 0) >= 3
    )
  },
  四杠: (f) => f.kongs.length === 4,
  连七对: () => false, // 特殊和型
  十三幺: () => false, // 特殊和型

  // 64 番
  清幺九: (f) => {
    return (
      f.pungs.length + f.kongs.length === 4 &&
      f.allTiles.every(
        (t) => isNumberSuit(t.suit) && (t.rank === 1 || t.rank === 9),
      )
    )
  },
  小四喜: (f) => {
    const windTiles = pungAndKongTiles(f).filter((t) => t.suit === 'wind')
    return windTiles.length === 3 && f.pair[0].suit === 'wind'
  },
  小三元: (f) => {
    const dragonTiles = pungAndKongTiles(f).filter((t) => t.suit === 'dragon')
    return dragonTiles.length === 2 && f.pair[0].suit === 'dragon'
  },
  字一色: (f) => {
    return f.allTiles.every((t) => t.suit === 'wind' || t.suit === 'dragon')
  },
  四暗刻: (f) => {
    return f.pungs.length + f.kongs.length === 4 && f.concealedPungCount === 4
  },
  一色双龙会: (f) => {
    if (f.pair[0].rank !== 5 || !isNumberSuit(f.pair[0].suit)) return false
    const suit = f.pair[0].suit
    const starts = chowStarts(f).filter((c) => c.suit === suit)
    const c1 = starts.filter((c) => c.rank === 1).length
    const c7 = starts.filter((c) => c.rank === 7).length
    return f.chows.length === 4 && c1 === 2 && c7 === 2
  },

  // 48 番
  一色四同顺: (f) => {
    if (f.chows.length !== 4) return false
    const starts = chowStarts(f)
    return new Set(starts.map((c) => `${c.suit}-${c.rank}`)).size === 1
  },
  一色四节高: (f) => {
    if (f.pungs.length !== 4) return false
    const suit = f.pungs[0].tile.suit
    if (!isNumberSuit(suit)) return false
    const ranks = f.pungs.map((p) => p.tile.rank).sort((a, b) => a - b)
    return (
      f.pungs.every((p) => p.tile.suit === suit) &&
      ranks[0] + 1 === ranks[1] &&
      ranks[1] + 1 === ranks[2] &&
      ranks[2] + 1 === ranks[3]
    )
  },

  // 32 番
  一色四步高: (f) => {
    if (f.chows.length !== 4) return false
    const suit = f.chows[0].tiles[0].suit
    if (f.chows.some((c) => c.tiles[0].suit !== suit)) return false
    const ranks = f.chows.map((c) => c.tiles[0].rank).sort((a, b) => a - b)
    return (
      ranks[0] + 1 === ranks[1] &&
      ranks[1] + 1 === ranks[2] &&
      ranks[2] + 1 === ranks[3]
    )
  },
  三杠: (f) => f.kongs.length === 3,
  混幺九: (f) => {
    return (
      f.pungs.length + f.kongs.length === 4 &&
      isAllTerminalsOrHonors(f.allTiles)
    )
  },

  // 24 番
  七对: () => false, // 特殊和型
  七星不靠: () => false, // 特殊和型
  全双刻: (f) => {
    return (
      f.pungs.length + f.kongs.length === 4 &&
      f.allTiles.every(
        (t) => isNumberSuit(t.suit) && [2, 4, 6, 8].includes(t.rank),
      )
    )
  },
  清一色: (f) => allSameNumberSuit(f),
  一色三同顺: (f) => {
    const starts = chowStarts(f)
    const byKey = new Map<string, number>()
    for (const c of starts) {
      const key = `${c.suit}-${c.rank}`
      byKey.set(key, (byKey.get(key) ?? 0) + 1)
    }
    return [...byKey.values()].some((n) => n === 3)
  },
  一色三节高: (f) => {
    // 同一花色、点数依次递增一位数的三副刻子（杠可替代刻）
    const suit = pungAndKongTiles(f).find((t) => isNumberSuit(t.suit))?.suit
    if (!suit) return false
    const ranks = pungAndKongTiles(f)
      .filter((t) => t.suit === suit)
      .map((t) => t.rank)
      .sort((a, b) => a - b)
    for (let i = 0; i + 2 < ranks.length; i++) {
      if (ranks[i] + 1 === ranks[i + 1] && ranks[i + 1] + 1 === ranks[i + 2])
        return true
    }
    return false
  },
  全大: (f) => f.allTiles.every((t) => isNumberSuit(t.suit) && t.rank >= 7),
  全中: (f) =>
    f.allTiles.every((t) => isNumberSuit(t.suit) && t.rank >= 4 && t.rank <= 6),
  全小: (f) => f.allTiles.every((t) => isNumberSuit(t.suit) && t.rank <= 3),

  // 16 番
  清龙: (f) => {
    const suit = f.chows[0]?.tiles[0].suit
    if (!suit || f.chows.length < 3) return false
    const ranks = chowStarts(f)
      .filter((c) => c.suit === suit)
      .map((c) => c.rank)
    return ranks.includes(1) && ranks.includes(4) && ranks.includes(7)
  },
  三色双龙会: (f) => {
    if (f.pair[0].rank !== 5 || !isNumberSuit(f.pair[0].suit)) return false
    const bySuit = new Map<string, Set<number>>()
    for (const c of chowStarts(f)) {
      if (!bySuit.has(c.suit)) bySuit.set(c.suit, new Set())
      bySuit.get(c.suit)!.add(c.rank)
    }
    const matched = [...bySuit.entries()].filter(
      ([, ranks]) => ranks.has(1) && ranks.has(7),
    )
    return matched.length === 2
  },
  一色三步高: (f) => {
    const suit = f.chows[0]?.tiles[0].suit
    if (!suit) return false
    const ranks = chowStarts(f)
      .filter((c) => c.suit === suit)
      .map((c) => c.rank)
      .sort((a, b) => a - b)
    for (let i = 0; i + 2 < ranks.length; i++) {
      if (ranks[i] + 1 === ranks[i + 1] && ranks[i + 1] + 1 === ranks[i + 2])
        return true
    }
    return false
  },
  全带五: (f) => {
    if (f.pair[0].rank !== 5 || !isNumberSuit(f.pair[0].suit)) return false
    return f.melds.every((m) => meldTiles(m).some((t) => t.rank === 5))
  },
  三同刻: (f) => {
    return [...pungRanksByNumber(f).values()].some((suits) => suits.size === 3)
  },
  三暗刻: (f) => f.concealedPungCount >= 3,

  // 12 番
  全不靠: () => false, // 特殊和型
  组合龙: () => false, // 特殊和型
  大于五: (f) => f.allTiles.every((t) => isNumberSuit(t.suit) && t.rank >= 6),
  小于五: (f) => f.allTiles.every((t) => isNumberSuit(t.suit) && t.rank <= 4),
  三风刻: (f) => {
    const windTiles = pungAndKongTiles(f).filter((t) => t.suit === 'wind')
    return new Set(windTiles.map((t) => t.rank)).size === 3
  },

  // 8 番
  花龙: (f) => {
    // 三种花色分别组成 123、456、789 三副顺子
    if (f.chows.length < 3) return false
    const chows = f.chows
    for (let i = 0; i < chows.length; i++) {
      for (let j = 0; j < chows.length; j++) {
        for (let k = 0; k < chows.length; k++) {
          if (i === j || j === k || i === k) continue
          const a = chows[i].tiles[0]
          const b = chows[j].tiles[0]
          const c = chows[k].tiles[0]
          const suits = new Set([a.suit, b.suit, c.suit])
          const ranks = new Set([a.rank, b.rank, c.rank])
          if (suits.size === 3 && ranks.has(1) && ranks.has(4) && ranks.has(7))
            return true
        }
      }
    }
    return false
  },
  推不倒: (f) => {
    return f.allTiles.every((t) => {
      if (t.suit === 'tong') return [1, 2, 3, 4, 5, 8, 9].includes(t.rank)
      if (t.suit === 'tiao') return [2, 4, 5, 6, 8, 9].includes(t.rank)
      if (t.suit === 'dragon') return t.rank === 3 // 白
      return false
    })
  },
  三色三同顺: (f) => {
    const byRank = new Map<number, Set<string>>()
    for (const c of chowStarts(f)) {
      if (!byRank.has(c.rank)) byRank.set(c.rank, new Set())
      byRank.get(c.rank)!.add(c.suit)
    }
    return [...byRank.values()].some((s) => s.size === 3)
  },
  三色三节高: (f) => {
    // 三种花色、点数依次递增 1 的三副刻子（如 555万 666筒 777条；杠可替代刻）
    const tiles = pungAndKongTiles(f)
    for (let i = 0; i < tiles.length; i++) {
      for (let j = 0; j < tiles.length; j++) {
        for (let k = 0; k < tiles.length; k++) {
          if (i === j || j === k || i === k) continue
          const a = tiles[i]
          const b = tiles[j]
          const c = tiles[k]
          if (
            !isNumberSuit(a.suit) ||
            !isNumberSuit(b.suit) ||
            !isNumberSuit(c.suit)
          )
            continue
          const suits = new Set([a.suit, b.suit, c.suit])
          if (suits.size !== 3) continue
          const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y)
          if (ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2])
            return true
        }
      }
    }
    return false
  },
  无番和: () => false, // 汇总逻辑处理
  妙手回春: (f, ctx) => ctx.isSelfDraw && ctx.isLastTile,
  海底捞月: (f, ctx) => !ctx.isSelfDraw && ctx.isLastTile,
  杠上开花: (f, ctx) => ctx.isKongReplacement,
  抢杠和: (f, ctx) => ctx.isRobbingKong,

  // 6 番
  碰碰和: (f) => f.pungs.length + f.kongs.length === 4,
  混一色: (f) => {
    return (
      f.numberSuits.size === 1 &&
      f.hasHonors &&
      !f.allTiles.every((t) => t.suit === 'wind' || t.suit === 'dragon')
    )
  },
  三色三步高: (f) => {
    // 三种花色、点数依次递增 1 的三副顺子（如 123万 234筒 345条）
    const chows = f.chows
    for (let i = 0; i < chows.length; i++) {
      for (let j = 0; j < chows.length; j++) {
        for (let k = 0; k < chows.length; k++) {
          if (i === j || j === k || i === k) continue
          const a = chows[i].tiles[0]
          const b = chows[j].tiles[0]
          const c = chows[k].tiles[0]
          const suits = new Set([a.suit, b.suit, c.suit])
          if (suits.size !== 3) continue
          const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y)
          if (ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2])
            return true
        }
      }
    }
    return false
  },
  五门齐: (f) => {
    const suits = new Set<string>(f.allTiles.map((t) => t.suit))
    return ['wan', 'tong', 'tiao', 'wind', 'dragon'].every((s) => suits.has(s))
  },
  全求人: (f, ctx) => {
    return (
      !ctx.isSelfDraw &&
      f.melds.length === 4 &&
      f.melds.every((m) => !m.concealed)
    )
  },
  双暗杠: (f) => f.concealedKongCount === 2,
  双箭刻: (f) => {
    const dragonTiles = pungAndKongTiles(f).filter((t) => t.suit === 'dragon')
    return new Set(dragonTiles.map((t) => t.rank)).size === 2
  },

  // 4 番
  全带幺: (f) => {
    if (!isAllTerminalsOrHonors(f.pair)) return false
    return f.melds.every((m) =>
      meldTiles(m).some((t) => isAllTerminalsOrHonors([t])),
    )
  },
  不求人: (f, ctx) => ctx.isSelfDraw && f.isConcealed,
  双明杠: (f) => f.exposedKongCount === 2,
  // 和绝张：所和牌是第 4 张（其余 3 张已亮出）。点炮时 visibleCount 含刚弃的那张。
  和绝张: (f, ctx) =>
    ctx.isSelfDraw ? ctx.visibleCount >= 3 : ctx.visibleCount >= 4,

  // 2 番
  箭刻: (f) => pungAndKongTiles(f).some((t) => t.suit === 'dragon'),
  圈风刻: (f, ctx) =>
    pungAndKongTiles(f).some(
      (t) => t.suit === 'wind' && t.rank === ctx.roundWind,
    ),
  门风刻: (f, ctx) =>
    pungAndKongTiles(f).some(
      (t) => t.suit === 'wind' && t.rank === ctx.seatWind,
    ),
  门前清: (f, ctx) => !ctx.isSelfDraw && f.isConcealed,
  平和: (f) => {
    return f.chows.length === 4 && !f.hasHonors && !isTerminalPair(f.pair)
  },
  四归一: (f) => {
    const counts = countTiles(f.allTiles)
    return f.kongs.length === 0 && [...counts.values()].some((c) => c >= 4)
  },
  双同刻: (f) => {
    return [...pungRanksByNumber(f).values()].some((suits) => suits.size === 2)
  },
  双暗刻: (f) => f.concealedPungCount >= 2,
  暗杠: (f) => f.concealedKongCount >= 1,
  断幺: (f) => !f.hasHonors && !f.hasTerminal,

  // 1 番
  一般高: (f) => {
    const seen = new Set<string>()
    for (const c of chowStarts(f)) {
      const key = `${c.suit}-${c.rank}`
      if (seen.has(key)) return true
      seen.add(key)
    }
    return false
  },
  喜相逢: (f) => {
    const byRank = new Map<number, Set<string>>()
    for (const c of chowStarts(f)) {
      if (!byRank.has(c.rank)) byRank.set(c.rank, new Set())
      byRank.get(c.rank)!.add(c.suit)
    }
    return [...byRank.values()].some((s) => s.size >= 2)
  },
  连六: (f) => {
    const starts = chowStarts(f)
    return starts.some((c) =>
      starts.some((x) => x.suit === c.suit && x.rank === c.rank + 3),
    )
  },
  老少副: (f) => {
    const starts = chowStarts(f)
    return starts.some(
      (c) =>
        c.rank === 1 && starts.some((x) => x.suit === c.suit && x.rank === 7),
    )
  },
  幺九刻: (f) => {
    return pungAndKongTiles(f).some(
      (t) => isNumberSuit(t.suit) && (t.rank === 1 || t.rank === 9),
    )
  },
  明杠: (f) => f.exposedKongCount >= 1,
  缺一门: (f) => f.numberSuits.size <= 2,
  无字: (f) => !f.hasHonors,
  边张: (f, ctx) => {
    const t = ctx.winTile
    if (!isNumberSuit(t.suit)) return false
    if (t.rank === 3)
      return hasTile(f, `${t.suit}1`) && hasTile(f, `${t.suit}2`)
    if (t.rank === 7)
      return hasTile(f, `${t.suit}8`) && hasTile(f, `${t.suit}9`)
    return false
  },
  坎张: (f, ctx) => {
    const t = ctx.winTile
    if (!isNumberSuit(t.suit) || t.rank < 2 || t.rank > 8) return false
    return (
      hasTile(f, `${t.suit}${t.rank - 1}`) &&
      hasTile(f, `${t.suit}${t.rank + 1}`)
    )
  },
  单钓将: (f, ctx) => {
    return tilesEqual(ctx.winTile, f.pair[0])
  },
  自摸: (f, ctx) => ctx.isSelfDraw,
  花牌: (f) => f.flowerCount > 0,
}

function hasTile(f: Features, key: string): boolean {
  return f.allTiles.some((t) => tileKey(t) === key)
}

function isTerminalPair(pair: [Tile, Tile]): boolean {
  return pair.some(
    (t) => isNumberSuit(t.suit) && (t.rank === 1 || t.rank === 9),
  )
}

// —— 特殊和型判定 ——

function specialHandType(hand: HandState): string | null {
  if (hand.melds.length > 0) return null
  const tiles = sortTilesForSpecial(hand.concealed)
  if (tiles.length !== 14) return null

  const counts = countTiles(tiles)
  if (isThirteenOrphans(counts)) return '十三幺'
  if (isSevenPairs(counts)) {
    return isConsecutiveSevenPairs(tiles) ? '连七对' : '七对'
  }
  if (isAllSingle(counts) && isAllNotContiguous(tiles)) {
    return isSevenStarredNotContiguous(counts) ? '七星不靠' : '全不靠'
  }
  if (isCombinedDragon(tiles)) return '组合龙'
  return null
}

function sortTilesForSpecial(tiles: readonly Tile[]): Tile[] {
  const suitOrder: Record<string, number> = {
    wan: 0,
    tong: 1,
    tiao: 2,
    wind: 3,
    dragon: 4,
  }
  return [...tiles].sort(
    (a, b) =>
      (suitOrder[a.suit] ?? 5) - (suitOrder[b.suit] ?? 5) || a.rank - b.rank,
  )
}

const ORPHAN_KEYS = [
  'wan1',
  'wan9',
  'tong1',
  'tong9',
  'tiao1',
  'tiao9',
  'wind1',
  'wind2',
  'wind3',
  'wind4',
  'dragon1',
  'dragon2',
  'dragon3',
]

function isThirteenOrphans(counts: Map<string, number>): boolean {
  let pairCount = 0
  for (const key of ORPHAN_KEYS) {
    const c = counts.get(key) ?? 0
    if (c === 0) return false
    if (c === 2) pairCount++
    else if (c !== 1) return false
  }
  return pairCount === 1
}

function isSevenPairs(counts: Map<string, number>): boolean {
  let pairs = 0
  for (const c of counts.values()) {
    if (c === 2) pairs++
    else if (c !== 0) return false
  }
  return pairs === 7
}

function isConsecutiveSevenPairs(tiles: Tile[]): boolean {
  const suit = tiles[0].suit
  if (!isNumberSuit(suit)) return false
  // 连七对：同花色 7 个连续点数（如 1–7、2–8、3–9）。
  // 七对已保证 7 个不同点数（各 2 张、共 14 张），点数跨度恰为 6 即连续。
  return (
    tiles.every((t) => t.suit === suit) &&
    tiles[tiles.length - 1].rank - tiles[0].rank === 6
  )
}

// 全不靠/七星不靠要求所有牌互不相同（无对子、无刻子）。
function isAllSingle(counts: Map<string, number>): boolean {
  for (const c of counts.values()) {
    if (c !== 1) return false
  }
  return true
}

function isAllNotContiguous(tiles: Tile[]): boolean {
  const bySuit = new Map<string, number[]>()
  for (const t of tiles) {
    if (!isNumberSuit(t.suit)) continue
    if (!bySuit.has(t.suit)) bySuit.set(t.suit, [])
    bySuit.get(t.suit)!.push(t.rank)
  }
  for (const ranks of bySuit.values()) {
    // 国标全不靠：数牌须按 147 / 258 / 369 取，即同花色点数模 3 余数相同。
    // 单张已由 isAllSingle 保证，故模 3 相同即等价于同一组的等差数列（点差 ≥3 自动成立）。
    const mod = ranks[0] % 3
    for (const r of ranks) {
      if (r % 3 !== mod) return false
    }
  }
  return true
}

function isSevenStarredNotContiguous(counts: Map<string, number>): boolean {
  for (let r = 1; r <= 4; r++) {
    if ((counts.get(`wind${r}`) ?? 0) < 1) return false
  }
  for (let r = 1; r <= 3; r++) {
    if ((counts.get(`dragon${r}`) ?? 0) < 1) return false
  }
  return true
}

// 组合龙：三种花色分别按 147、258、369 三组取牌（每花色三张、点数互异且模 3 相同），
// 三组覆盖 1/2/0 三个余数；剩余 5 张（1 面子 + 1 对）通过拆解验证。
function isCombinedDragon(tiles: Tile[]): boolean {
  const bySuit = new Map<string, number[]>()
  for (const t of tiles) {
    if (!isNumberSuit(t.suit)) continue
    if (!bySuit.has(t.suit)) bySuit.set(t.suit, [])
    bySuit.get(t.suit)!.push(t.rank)
  }

  // 必须恰好三种数牌花色，且每花色恰好 3 张互异的数牌。
  if (bySuit.size !== 3) return false
  const mods = new Set<number>()
  for (const ranks of bySuit.values()) {
    if (ranks.length !== 3 || new Set(ranks).size !== 3) return false
    const mod = ranks[0] % 3
    if (ranks.some((r) => r % 3 !== mod)) return false
    mods.add(mod)
  }
  // 三个花色的余数须覆盖 0/1/2（即三组不同）。
  if (mods.size !== 3) return false

  // 剔除「龙」的三组数牌后，剩余 5 张须能拆成 1 面子 + 1 对。
  const dragonKeys = new Set<string>()
  for (const [suit, ranks] of bySuit) {
    for (const r of ranks) dragonKeys.add(`${suit}${r}`)
  }
  const remaining = tiles.filter((t) => !dragonKeys.has(`${t.suit}${t.rank}`))
  if (remaining.length !== 5) return false
  return decompose(remaining, 1).length > 0
}

// —— 番种汇总与不重复原则 ——

function resolveFan(matched: Map<string, number>): FanEntry[] {
  const excluded = new Set<string>()

  // 不重复原则 · 包含关系：若高番 A 包含低番 B 且二者都命中，排除 B。
  for (const [higher, lowers] of Object.entries(IMPLIES)) {
    if (!matched.has(higher)) continue
    for (const lower of lowers) {
      if (matched.has(lower)) excluded.add(lower)
    }
  }

  // 不重复原则 · 真互斥：同一组内仅保留番值最高者。
  for (const group of MUTUALLY_EXCLUSIVE) {
    const present = group.filter((name) => matched.has(name))
    if (present.length > 1) {
      present.sort((a, b) => matched.get(b)! - matched.get(a)!)
      for (let i = 1; i < present.length; i++) excluded.add(present[i])
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

// —— 主入口 ——

export function evaluateWin(
  hand: HandState,
  ctx: WinContext,
): WinningInfo | null {
  const flowerFan = hand.flowers.length
  const candidates: WinningInfo[] = []

  // 候选一：特殊和型（七对/十三幺/全不靠等）。
  const special = specialHandType(hand)
  if (special) {
    const matched = new Map<string, number>()
    matched.set(special, FAN_VALUES[special])
    if (flowerFan > 0) matched.set('花牌', flowerFan)
    if (ctx.isSelfDraw) matched.set('自摸', 1)
    if (ctx.isLastTile) matched.set(ctx.isSelfDraw ? '妙手回春' : '海底捞月', 8)
    if (ctx.isKongReplacement) matched.set('杠上开花', 8)
    const fan = resolveFan(matched)
    candidates.push({
      fan,
      totalFan: sumFan(fan),
      decomposition: null,
      specialHand: special,
    })
  }

  // 候选二：标准拆解，取各拆解中总番最高者。
  const meldCount = 4 - hand.melds.length
  const decomps = decompose(hand.concealed, meldCount)
  let bestStandard: WinningInfo | null = null
  for (const decomposition of decomps) {
    const features = buildFeatures(hand, decomposition)
    const matched = new Map<string, number>()
    for (const [name, pred] of Object.entries(PREDICATES)) {
      if (pred(features, ctx)) matched.set(name, FAN_VALUES[name])
    }
    if (flowerFan > 0) matched.set('花牌', flowerFan)
    if (ctx.isSelfDraw) matched.set('自摸', 1)

    const fan = resolveFan(matched)
    const totalFan = sumFan(fan)
    if (!bestStandard || totalFan > bestStandard.totalFan) {
      bestStandard = { fan, totalFan, decomposition }
    }
  }
  if (bestStandard) candidates.push(bestStandard)

  if (candidates.length === 0) return null

  // 取总番最高者，再检验起胡门槛。
  candidates.sort((a, b) => b.totalFan - a.totalFan)
  const best = candidates[0]
  if (best.totalFan < MIN_FAN) return null
  return best
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
  // 自摸与否由 discarder 是否为 null 决定（「自摸」番种可能被「不求人」等吞掉，不可据其判断）。
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
