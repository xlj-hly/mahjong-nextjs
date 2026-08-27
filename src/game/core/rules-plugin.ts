// 规则插件接口：引擎核心只依赖该接口，不 import 任何具体规则。

import type { Tile } from './tile'
import type { Meld, Decomposition } from './decompose'
import type { Wall } from './wall'

export type Seat = 0 | 1 | 2 | 3

export interface HandState {
  /** 隐藏手牌（已排序，不含花牌、不含副露）。 */
  concealed: Tile[]
  /** 已亮出的花牌。 */
  flowers: Tile[]
  /** 已亮出的副露（吃/碰/明杠/暗杠）。 */
  melds: Meld[]
}

export interface FanEntry {
  name: string
  value: number
}

export interface WinningInfo {
  /** 应用不重复原则后最终计入的番种列表。 */
  fan: FanEntry[]
  /** 总番数。 */
  totalFan: number
  /** 标准牌型的拆解；特殊牌型（七对/十三幺/全不靠等）为 null。 */
  decomposition: Decomposition | null
  /** 特殊牌型名称，标准牌型为 undefined。 */
  specialHand?: string
}

export interface WinContext {
  seat: Seat
  /** 和牌的那张牌（自摸的牌或点炮的牌）。 */
  winTile: Tile
  /** 是否自摸（否则为点炮）。 */
  isSelfDraw: boolean
  /** 是否庄家。 */
  isDealer: boolean
  /** 门风（1=东 2=南 3=西 4=北）。 */
  seatWind: number
  /** 圈风（1=东 2=南 3=西 4=北）。 */
  roundWind: number
  /** 是否牌墙最后一张（妙手回春/海底捞月）。 */
  isLastTile: boolean
  /** 是否杠上补牌（杠上开花）。 */
  isKongReplacement: boolean
  /** 是否抢杠（抢杠和）。 */
  isRobbingKong: boolean
  /** 和牌那张牌在牌河与副露中已亮出的张数（和绝张：自摸时 ≥3，点炮时 ≥4 张中含所和的那张）。 */
  visibleCount: number
}

export interface ScoreContext {
  seat: Seat
  isDealer: boolean
  totalFan: number
  basePoints: number
  /** 点炮者；自摸时为 null。 */
  discarder: Seat | null
}

export interface ScoreResult {
  winner: Seat
  selfDraw: boolean
  totalFan: number
  /** 每条支付记录：from 支付方，to 收付方，points 分数。 */
  payments: Array<{ from: Seat; to: Seat; points: number }>
}

export type KongKind = 'melded' | 'concealed' | 'added'

export interface KongOption {
  kind: KongKind
  tile: Tile
}

export interface RulesPlugin {
  /** 插件标识，如 'guobiao'。 */
  id: string
  /** 按规则构建完整牌墙。 */
  buildWall(rng?: () => number): Wall
  /** 该牌是否为花牌（需要补花）。 */
  isFlower(tile: Tile): boolean
  /** 吃：返回能与 discard 组成顺子的两对隐藏牌；不可吃返回空数组。 */
  legalChow(concealed: Tile[], discard: Tile): [Tile, Tile][]
  /** 碰：能否用 discard 组成刻子。 */
  canPong(concealed: Tile[], discard: Tile): boolean
  /** 杠：返回当前所有可杠方式；discard 为 null 表示自摸后的暗杠/补杠。 */
  kongOptions(hand: HandState, discard: Tile | null): KongOption[]
  /** 和牌判定 + 番数计算；不可和（含不足起胡门槛）返回 null。 */
  evaluateWin(hand: HandState, ctx: WinContext): WinningInfo | null
  /** 结算。 */
  calcScore(win: WinningInfo, ctx: ScoreContext): ScoreResult
}
