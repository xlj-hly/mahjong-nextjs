// 命令行 headless 对局脚本：自动跑完整一局，验证引擎端到端可运行。
// 用法：npx tsx src/cli.ts（在 packages/game-core 内）  或  node --experimental-strip-types ...

import { createRunner } from './runner'
import type { Action, Snapshot } from './core/state-machine'
import type { RulesPlugin, Seat } from './core/rules-plugin'

// 简单策略：定缺时选第一门；否则优先赢，其次碰/杠，其次吃，否则出第一张可出的牌。
function chooseAction(snap: Snapshot): Action {
  const actions = snap.legalActions
  const byType = (t: string) => actions.find((a) => a.type === t)

  if (byType('voidSuit')) return byType('voidSuit')!
  if (byType('win')) return { type: 'win' }
  if (byType('kong')) return byType('kong')!
  if (byType('pong')) return { type: 'pong' }
  const chow = actions.find((a) => a.type === 'chow')
  if (chow) return chow
  const discard = actions.find((a) => a.type === 'discard')
  if (discard) return discard
  if (byType('draw')) return { type: 'draw' }
  return { type: 'pass' }
}

export function runAutoGame(
  plugin?: RulesPlugin,
  rng?: () => number,
): Snapshot | null {
  const runner = createRunner(plugin, rng)
  let guard = 0
  while (!runner.isOver() && guard++ < 2000) {
    const overview = runner.snapshot(0)
    // claim 阶段由 activeClaimer 行动，其余阶段由 current 行动。
    const actor = (overview.activeClaimer ?? overview.current) as Seat
    const snap = runner.snapshot(actor)
    const action = chooseAction(snap)
    runner.apply(actor, action)
  }
  const final = runner.snapshot(0)
  if (final.phase === 'ended') return final
  return null
}

export function describeWin(final: Snapshot): string {
  if (final.winInfo) {
    const fan = final.winInfo.fan.map((f) => `${f.name}(${f.value})`).join('、')
    return `和牌！番种：${fan}；总番：${final.winInfo.totalFan}`
  }
  return '荒庄（流局）'
}

// 直接执行（当作为 CLI 脚本运行时）。
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const final = runAutoGame()
  if (final) {
    console.log(describeWin(final))
    if (final.score) {
      for (const p of final.score.payments) {
        console.log(`座位 ${p.from} → 座位 ${p.to}：${p.points} 分`)
      }
    }
  } else {
    console.log('对局未在步数限制内结束')
  }
}
