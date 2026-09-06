'use client'

// 热座对局状态容器：持有 headless 运行器，只做「消费 snapshot 展示」与「上报意图」。
// 组件内不含任何合法性或番数判断逻辑。

import { useCallback, useState } from 'react'
import {
  createRunner,
  guobiao,
  type Action,
  type Runner,
  type Seat,
  type Snapshot,
} from '@mahjong/game-core'
import type { RuleId } from '@mahjong/protocol'
import { RULES } from '@/lib/rules'

function computeSnapshot(runner: Runner): Snapshot {
  const overview = runner.snapshot(0)
  const actor = (overview.activeClaimer ?? overview.current) as Seat
  return runner.snapshot(actor)
}

export function useHotseatGame() {
  const [runner, setRunner] = useState<Runner>(() => createRunner(guobiao))
  const [ruleId, setRuleId] = useState<RuleId>('guobiao')
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
    (id: RuleId = ruleId) => {
      const rule = RULES.find((r) => r.id === id) ?? RULES[0]
      setRunner(createRunner(rule.plugin))
      setRuleId(rule.id)
      setVersion((v) => v + 1)
    },
    [ruleId],
  )

  return { snapshot, apply, reset, ruleId }
}
