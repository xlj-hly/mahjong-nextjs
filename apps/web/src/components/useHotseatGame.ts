'use client'

// 热座对局状态容器：持有 headless 运行器，只做「消费 snapshot 展示」与「上报意图」。
// 组件内不含任何合法性或番数判断逻辑。

import { useCallback, useState } from 'react'
import {
  createRunner,
  guobiao,
  sichuan,
  type Action,
  type RulesPlugin,
  type Runner,
  type Seat,
  type Snapshot,
} from '@mahjong/game-core'

export const RULES: Array<{ id: string; label: string; plugin: RulesPlugin }> =
  [
    { id: 'guobiao', label: '国标麻将', plugin: guobiao },
    { id: 'sichuan', label: '四川麻将', plugin: sichuan },
  ]

function computeSnapshot(runner: Runner): Snapshot {
  const overview = runner.snapshot(0)
  const actor = (overview.activeClaimer ?? overview.current) as Seat
  return runner.snapshot(actor)
}

export function useHotseatGame() {
  const [runner, setRunner] = useState<Runner>(() => createRunner(guobiao))
  const [ruleId, setRuleId] = useState('guobiao')
  const [, setVersion] = useState(0)

  const snapshot = computeSnapshot(runner)

  const apply = useCallback(
    (action: Action) => {
      const overview = runner.snapshot(0)
      const actor = (overview.activeClaimer ?? overview.current) as Seat
      runner.apply(actor, action)
      setVersion((v) => v + 1)
    },
    [runner],
  )

  const reset = useCallback(
    (id: string = ruleId) => {
      const rule = RULES.find((r) => r.id === id) ?? RULES[0]
      setRunner(createRunner(rule.plugin))
      setRuleId(rule.id)
      setVersion((v) => v + 1)
    },
    [ruleId],
  )

  return { snapshot, apply, reset, ruleId }
}
