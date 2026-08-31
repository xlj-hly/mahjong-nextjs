// @mahjong/game-core 公开入口：统一 re-export 引擎核心、规则插件与 headless 运行器。

export { Game, seatName } from './core/state-machine'
export { Wall } from './core/wall'
export { decompose } from './core/decompose'
export { tileLabel, sortTiles } from './core/tile'
export { guobiao } from './rules/guobiao'
export { sichuan } from './rules/sichuan'
export { createRunner } from './runner'

export type {
  Action,
  GamePhase,
  HandView,
  PendingDiscard,
  Snapshot,
} from './core/state-machine'
export type { Decomposition, Meld } from './core/decompose'
export type { Suit, Tile } from './core/tile'
export type {
  ActionContext,
  FanEntry,
  HandState,
  KongKind,
  KongOption,
  RulesPlugin,
  ScoreContext,
  ScoreResult,
  Seat,
  WinContext,
  WinningInfo,
} from './core/rules-plugin'
export type { Runner } from './runner'
