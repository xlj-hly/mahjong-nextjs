// 行牌状态机骨架：规则无关的机械层。
// 管理庄家/方位/发牌/摸牌/出牌/吃碰杠和的回合流转与结束判定，
// 所有规则判断（花牌、动作合法性、和牌、番数、结算）委托给 RulesPlugin。

import { sortTiles, tilesEqual, type Tile } from './tile'
import { type Meld } from './decompose'
import type { Wall } from './wall'
import type {
  HandState,
  KongKind,
  RulesPlugin,
  ScoreResult,
  Seat,
  WinningInfo,
} from './rules-plugin'

export type GamePhase = 'draw' | 'discard' | 'claim' | 'ended'

export type Action =
  | { type: 'draw' }
  | { type: 'discard'; tile: Tile }
  | { type: 'win' }
  | { type: 'pong' }
  | { type: 'chow'; tiles: [Tile, Tile] }
  | { type: 'kong'; kind: KongKind; tile: Tile }
  | { type: 'pass' }

export interface HandView {
  concealedCount: number
  /** 仅自己的手牌可见；其他座位为 undefined。 */
  concealed?: Tile[]
  flowers: Tile[]
  melds: Meld[]
}

export interface PendingDiscard {
  seat: Seat
  tile: Tile
}

export interface Snapshot {
  seat: Seat
  phase: GamePhase
  dealer: Seat
  current: Seat
  roundWind: number
  seatWind: number
  wallRemaining: number
  hands: HandView[]
  discards: Tile[][]
  pendingDiscard: PendingDiscard | null
  activeClaimer: Seat | null
  legalActions: Action[]
  winner: Seat | null
  winInfo: WinningInfo | null
  score: ScoreResult | null
}

const SEAT_NAMES = ['东', '南', '西', '北'] as const

export function seatName(seat: Seat): string {
  return SEAT_NAMES[seat]
}

interface ClaimCapability {
  win: boolean
  pong: boolean
  kong: boolean
  chow: boolean
}

export class Game {
  readonly plugin: RulesPlugin
  private wall: Wall
  private hands: HandState[]
  private discards: Tile[][]
  private dealer: Seat
  private roundWind: number
  private current: Seat
  private phase: GamePhase
  private pendingDiscard: PendingDiscard | null
  private activeClaimer: Seat | null
  /** 按优先级排序的待响应队列（和 > 碰/杠 > 吃，同级内离弃牌者近者优先）。 */
  private claimers: Seat[]
  private winner: Seat | null
  private winInfo: WinningInfo | null
  private score: ScoreResult | null
  private lastDrawn: Tile | null
  private kongReplacement: boolean

  constructor(plugin: RulesPlugin, rng?: () => number) {
    this.plugin = plugin
    this.wall = plugin.buildWall(rng)
    this.hands = [0, 1, 2, 3].map(() => ({
      concealed: [],
      flowers: [],
      melds: [],
    }))
    this.discards = [[], [], [], []]
    this.dealer = 0
    this.roundWind = 1
    this.current = 0
    this.phase = 'draw'
    this.pendingDiscard = null
    this.activeClaimer = null
    this.claimers = []
    this.winner = null
    this.winInfo = null
    this.score = null
    this.lastDrawn = null
    this.kongReplacement = false

    this.deal()
    // 发牌后补花，庄家起手摸第 14 张进入出牌阶段。
    for (let s = 0; s < 4; s++) this.settleFlowers(s as Seat)
    this.phase = 'draw'
    this.current = this.dealer
  }

  // —— 发牌 ——

  private deal(): void {
    for (let round = 0; round < 13; round++) {
      for (let s = 0; s < 4; s++) {
        const t = this.wall.draw()
        if (t) this.hands[s].concealed.push(t)
      }
    }
    for (let s = 0; s < 4; s++) {
      this.hands[s].concealed = sortTiles(this.hands[s].concealed)
    }
  }

  // 将手中花牌移入 flowers 并从牌墙补牌，直至手牌无花牌。补到非花牌留在手牌。
  private settleFlowers(seat: Seat): void {
    let guard = 0
    while (this.hands[seat].concealed.some((t) => this.plugin.isFlower(t))) {
      if (guard++ > 200) break
      const idx = this.hands[seat].concealed.findIndex((t) =>
        this.plugin.isFlower(t),
      )
      const [flower] = this.hands[seat].concealed.splice(idx, 1)
      this.hands[seat].flowers.push(flower)
      const t = this.wall.draw()
      if (t) this.hands[seat].concealed.push(t)
      else break
    }
    this.hands[seat].concealed = sortTiles(this.hands[seat].concealed)
  }

  private seatWindOf(seat: Seat): number {
    return ((seat - this.dealer + 4) % 4) + 1
  }

  // —— 动作 ——

  apply(seat: Seat, action: Action): void {
    if (this.phase === 'ended') throw new Error('对局已结束')
    switch (action.type) {
      case 'draw':
        this.doDraw(seat)
        break
      case 'discard':
        this.doDiscard(seat, action.tile)
        break
      case 'win':
        this.doWin(seat)
        break
      case 'pong':
        this.doPong(seat)
        break
      case 'chow':
        this.doChow(seat, action.tiles)
        break
      case 'kong':
        this.doKong(seat, action.kind, action.tile)
        break
      case 'pass':
        this.doPass(seat)
        break
    }
  }

  private doDraw(seat: Seat): void {
    if (this.phase !== 'draw' || seat !== this.current) {
      throw new Error('当前不可摸牌')
    }
    const t = this.wall.draw()
    if (!t) {
      // 牌墙耗尽：荒庄（流局），无和牌者。
      this.end(null, null, null)
      return
    }
    this.hands[seat].concealed.push(t)
    this.settleFlowers(seat)
    this.lastDrawn = t
    this.kongReplacement = false
    this.phase = 'discard'
  }

  private doDiscard(seat: Seat, tile: Tile): void {
    if (this.phase !== 'discard' || seat !== this.current) {
      throw new Error('当前不可出牌')
    }
    const idx = this.hands[seat].concealed.findIndex((t) => tilesEqual(t, tile))
    if (idx === -1) throw new Error('手牌中无此牌')
    this.hands[seat].concealed.splice(idx, 1)
    this.discards[seat].push(tile)
    this.resolveDiscard(seat, tile)
  }

  private resolveDiscard(discarder: Seat, tile: Tile): void {
    const order: Seat[] = [1, 2, 3].map((i) => ((discarder + i) % 4) as Seat)

    // 优先级：和 > 碰/杠 > 吃。同级内按离弃牌者近者优先。
    const winners = order.filter((s) => this.canDiscardWin(s, tile))
    const pongKong = order.filter(
      (s) =>
        this.plugin.canPong(this.hands[s].concealed, tile) ||
        this.plugin.kongOptions(this.hands[s], tile).length > 0,
    )
    const chowSeat = order[0]
    const canChow =
      this.plugin.legalChow(this.hands[chowSeat].concealed, tile).length > 0

    const queue =
      winners.length > 0
        ? winners
        : pongKong.length > 0
          ? pongKong
          : canChow
            ? [chowSeat]
            : []

    if (queue.length > 0) {
      this.phase = 'claim'
      this.pendingDiscard = { seat: discarder, tile }
      this.claimers = queue
      this.activeClaimer = queue[0]
      return
    }

    this.advanceTurn(chowSeat)
  }

  private advanceTurn(next: Seat): void {
    this.pendingDiscard = null
    this.activeClaimer = null
    this.claimers = []
    this.current = next
    this.phase = 'draw'
  }

  private doWin(seat: Seat): void {
    if (this.phase === 'discard' && seat === this.current) {
      const info = this.evaluateSelfDrawWin(seat)
      if (!info) throw new Error('当前手牌不可和')
      this.end(
        seat,
        info,
        this.plugin.calcScore(info, this.scoreCtx(seat, info.totalFan, null)),
      )
      return
    }
    if (
      this.phase === 'claim' &&
      seat === this.activeClaimer &&
      this.pendingDiscard
    ) {
      const info = this.canDiscardWin(seat, this.pendingDiscard.tile)
      if (!info) throw new Error('当前手牌不可和')
      this.end(
        seat,
        info,
        this.plugin.calcScore(
          info,
          this.scoreCtx(seat, info.totalFan, this.pendingDiscard.seat),
        ),
      )
      return
    }
    throw new Error('当前不可和牌')
  }

  private doPong(seat: Seat): void {
    if (
      this.phase !== 'claim' ||
      seat !== this.activeClaimer ||
      !this.pendingDiscard
    ) {
      throw new Error('当前不可碰')
    }
    const { tile } = this.pendingDiscard
    if (!this.plugin.canPong(this.hands[seat].concealed, tile)) {
      throw new Error('手牌不足两张，不可碰')
    }
    // 从手牌移除两张，与弃牌组成刻子副露。
    const meld: Meld = { type: 'pung', tile, concealed: false }
    this.hands[seat].melds.push(meld)
    for (let i = 0; i < 2; i++) {
      const idx = this.hands[seat].concealed.findIndex((t) =>
        tilesEqual(t, tile),
      )
      this.hands[seat].concealed.splice(idx, 1)
    }
    this.current = seat
    this.pendingDiscard = null
    this.activeClaimer = null
    this.claimers = []
    this.phase = 'discard'
  }

  private doChow(seat: Seat, pair: [Tile, Tile]): void {
    if (
      this.phase !== 'claim' ||
      seat !== this.activeClaimer ||
      !this.pendingDiscard
    ) {
      throw new Error('当前不可吃')
    }
    if (!this.isNextSeat(seat)) {
      throw new Error('只有下家可以吃')
    }
    const { tile: discard } = this.pendingDiscard
    const options = this.plugin.legalChow(this.hands[seat].concealed, discard)
    const found = options.some(
      ([a, b]) =>
        (tilesEqual(a, pair[0]) && tilesEqual(b, pair[1])) ||
        (tilesEqual(a, pair[1]) && tilesEqual(b, pair[0])),
    )
    if (!found) throw new Error('所选牌不能与弃牌组成顺子')
    const tiles = sortTiles([discard, pair[0], pair[1]]) as [Tile, Tile, Tile]
    const meld: Meld = { type: 'chow', tiles, concealed: false }
    this.hands[seat].melds.push(meld)
    for (const t of pair) {
      const idx = this.hands[seat].concealed.findIndex((x) => tilesEqual(x, t))
      this.hands[seat].concealed.splice(idx, 1)
    }
    this.current = seat
    this.pendingDiscard = null
    this.activeClaimer = null
    this.claimers = []
    this.phase = 'discard'
  }

  private doKong(seat: Seat, kind: KongKind, tile: Tile): void {
    if (
      this.phase === 'claim' &&
      seat === this.activeClaimer &&
      this.pendingDiscard
    ) {
      if (kind !== 'melded') throw new Error('吃碰阶段只能明杠')
      const options = this.plugin.kongOptions(
        this.hands[seat],
        this.pendingDiscard.tile,
      )
      if (
        !options.some((o) => o.kind === 'melded' && tilesEqual(o.tile, tile))
      ) {
        throw new Error('不可明杠')
      }
      const meld: Meld = { type: 'kong', tile, concealed: false }
      this.hands[seat].melds.push(meld)
      for (let i = 0; i < 3; i++) {
        const idx = this.hands[seat].concealed.findIndex((t) =>
          tilesEqual(t, tile),
        )
        this.hands[seat].concealed.splice(idx, 1)
      }
      this.pendingDiscard = null
      this.activeClaimer = null
      this.claimers = []
      this.current = seat
      this.phase = 'discard'
      return
    }
    if (this.phase === 'discard' && seat === this.current) {
      const options = this.plugin.kongOptions(this.hands[seat], null)
      if (!options.some((o) => o.kind === kind && tilesEqual(o.tile, tile))) {
        throw new Error('不可杠')
      }
      if (kind === 'concealed') {
        const meld: Meld = { type: 'kong', tile, concealed: true }
        this.hands[seat].melds.push(meld)
        for (let i = 0; i < 4; i++) {
          const idx = this.hands[seat].concealed.findIndex((t) =>
            tilesEqual(t, tile),
          )
          this.hands[seat].concealed.splice(idx, 1)
        }
      } else if (kind === 'added') {
        const meld: Meld = { type: 'kong', tile, concealed: false }
        this.hands[seat].melds.push(meld)
        const pungIdx = this.hands[seat].melds.findIndex(
          (m) => m.type === 'pung' && tilesEqual(m.tile, tile),
        )
        if (pungIdx !== -1) this.hands[seat].melds.splice(pungIdx, 1)
        const idx = this.hands[seat].concealed.findIndex((t) =>
          tilesEqual(t, tile),
        )
        this.hands[seat].concealed.splice(idx, 1)
      }
      // 杠后补一张牌。
      const t = this.wall.draw()
      if (!t) {
        this.end(null, null, null)
        return
      }
      this.hands[seat].concealed.push(t)
      this.settleFlowers(seat)
      this.lastDrawn = t
      this.kongReplacement = true
      this.phase = 'discard'
      return
    }
    throw new Error('当前不可杠')
  }

  private doPass(seat: Seat): void {
    if (this.phase !== 'claim' || seat !== this.activeClaimer) {
      throw new Error('当前无需响应')
    }
    // 移动到队列中的下一个响应者；队列耗尽则进入下家摸牌。
    const idx = this.claimers.indexOf(seat)
    const nextClaimer = this.claimers[idx + 1]
    if (nextClaimer !== undefined) {
      this.activeClaimer = nextClaimer
      return
    }
    const discarder = this.pendingDiscard?.seat ?? this.current
    this.advanceTurn(((discarder + 1) % 4) as Seat)
  }

  // —— 和牌判定（委托插件）——

  private evaluateSelfDrawWin(seat: Seat): WinningInfo | null {
    const hand = this.hands[seat]
    const winTile = this.lastDrawn ?? hand.concealed[hand.concealed.length - 1]
    return this.plugin.evaluateWin(hand, {
      seat,
      winTile,
      isSelfDraw: true,
      isDealer: seat === this.dealer,
      seatWind: this.seatWindOf(seat),
      roundWind: this.roundWind,
      isLastTile: this.wall.isEmpty,
      isKongReplacement: this.kongReplacement,
      isRobbingKong: false,
      visibleCount: this.countVisible(winTile),
    })
  }

  private canDiscardWin(seat: Seat, tile: Tile): WinningInfo | null {
    const hand: HandState = {
      ...this.hands[seat],
      concealed: sortTiles([...this.hands[seat].concealed, tile]),
    }
    return this.plugin.evaluateWin(hand, {
      seat,
      winTile: tile,
      isSelfDraw: false,
      isDealer: seat === this.dealer,
      seatWind: this.seatWindOf(seat),
      roundWind: this.roundWind,
      isLastTile: this.wall.isEmpty,
      isKongReplacement: false,
      isRobbingKong: false,
      // 点炮时，所和的那张已在牌河中（由调用方推进后统计）。
      visibleCount: this.countVisible(tile),
    })
  }

  /** 统计某张牌在所有牌河与副露（明/暗刻杠、顺子）中已亮出的张数。 */
  private countVisible(tile: Tile): number {
    let count = 0
    for (const discards of this.discards) {
      for (const t of discards) if (tilesEqual(t, tile)) count++
    }
    for (const h of this.hands) {
      for (const meld of h.melds) {
        if (meld.type === 'chow') {
          for (const t of meld.tiles) if (tilesEqual(t, tile)) count++
        } else if (meld.type === 'pung') {
          if (tilesEqual(meld.tile, tile)) count += 3
        } else {
          if (tilesEqual(meld.tile, tile)) count += 4
        }
      }
    }
    return count
  }

  private scoreCtx(seat: Seat, totalFan: number, discarder: Seat | null) {
    return {
      seat,
      isDealer: seat === this.dealer,
      totalFan,
      basePoints: 1,
      discarder,
    }
  }

  private end(
    winner: Seat | null,
    info: WinningInfo | null,
    score: ScoreResult | null,
  ): void {
    this.phase = 'ended'
    this.winner = winner
    this.winInfo = info
    this.score = score
  }

  // —— 快照 ——

  private legalActions(seat: Seat): Action[] {
    if (this.phase === 'ended') return []
    if (this.phase === 'draw') {
      return seat === this.current ? [{ type: 'draw' }] : []
    }
    if (this.phase === 'discard') {
      if (seat !== this.current) return []
      const actions: Action[] = []
      const seen = new Set<string>()
      for (const t of this.hands[seat].concealed) {
        const key = `${t.suit}${t.rank}`
        if (!seen.has(key)) {
          seen.add(key)
          actions.push({ type: 'discard', tile: t })
        }
      }
      if (this.evaluateSelfDrawWin(seat)) actions.push({ type: 'win' })
      for (const opt of this.plugin.kongOptions(this.hands[seat], null)) {
        actions.push({ type: 'kong', kind: opt.kind, tile: opt.tile })
      }
      return actions
    }
    if (this.phase === 'claim') {
      if (seat !== this.activeClaimer || !this.pendingDiscard) return []
      const { tile } = this.pendingDiscard
      const actions: Action[] = []
      const cap = this.claimCapability(seat, tile)
      if (cap.win) actions.push({ type: 'win' })
      if (cap.pong) actions.push({ type: 'pong' })
      if (cap.kong) actions.push({ type: 'kong', kind: 'melded', tile })
      if (this.isNextSeat(seat)) {
        for (const pair of this.plugin.legalChow(
          this.hands[seat].concealed,
          tile,
        )) {
          actions.push({ type: 'chow', tiles: pair })
        }
      }
      actions.push({ type: 'pass' })
      return actions
    }
    return []
  }

  private claimCapability(seat: Seat, tile: Tile): ClaimCapability {
    return {
      win: this.canDiscardWin(seat, tile) !== null,
      pong: this.plugin.canPong(this.hands[seat].concealed, tile),
      kong: this.plugin.kongOptions(this.hands[seat], tile).length > 0,
      chow:
        this.isNextSeat(seat) &&
        this.plugin.legalChow(this.hands[seat].concealed, tile).length > 0,
    }
  }

  /** seat 是否为当前弃牌者的下家（只有下家能吃）。 */
  private isNextSeat(seat: Seat): boolean {
    const discarder = this.pendingDiscard?.seat
    return discarder !== undefined && seat === (discarder + 1) % 4
  }

  snapshot(seat: Seat): Snapshot {
    const hands: HandView[] = this.hands.map((h, i) => ({
      concealedCount: h.concealed.length,
      concealed: i === seat ? [...h.concealed] : undefined,
      flowers: [...h.flowers],
      melds: [...h.melds],
    }))
    return {
      seat,
      phase: this.phase,
      dealer: this.dealer,
      current: this.current,
      roundWind: this.roundWind,
      seatWind: this.seatWindOf(seat),
      wallRemaining: this.wall.remaining,
      hands,
      discards: this.discards.map((d) => [...d]),
      pendingDiscard: this.pendingDiscard ? { ...this.pendingDiscard } : null,
      activeClaimer: this.activeClaimer,
      legalActions: this.legalActions(seat),
      winner: this.winner,
      winInfo: this.winInfo,
      score: this.score,
    }
  }

  get isOver(): boolean {
    return this.phase === 'ended'
  }
}
