// headless 对局运行器：持引擎实例 + 规则插件，仅暴露 snapshot/apply 两个口子。
// 不依赖 React/next，可被 CLI、UI、后续服务端复用。

import { Game, type Action, type Snapshot } from './core/state-machine'
import type { RulesPlugin, Seat } from './core/rules-plugin'
import { guobiao } from './rules/guobiao'

export interface Runner {
  snapshot(seat: Seat): Snapshot
  apply(seat: Seat, action: Action): void
  isOver(): boolean
}

export function createRunner(
  plugin: RulesPlugin = guobiao,
  rng?: () => number,
): Runner {
  const game = new Game(plugin, rng)
  return {
    snapshot: (seat) => game.snapshot(seat),
    apply: (seat, action) => game.apply(seat, action),
    isOver: () => game.isOver,
  }
}
