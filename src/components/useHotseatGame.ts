'use client'

// 热座对局状态容器：持有 headless 运行器，只做「消费 snapshot 展示」与「上报意图」。
// 组件内不含任何合法性或番数判断逻辑。

import { useCallback, useState } from 'react'
import { createRunner, type Runner } from '@/game/runner'
import type { Action, Snapshot } from '@/game/core/state-machine'
import type { Seat } from '@/game/core/rules-plugin'

function computeSnapshot(runner: Runner): Snapshot {
  const overview = runner.snapshot(0)
  const actor = (overview.activeClaimer ?? overview.current) as Seat
  return runner.snapshot(actor)
}

export function useHotseatGame() {
  const [runner, setRunner] = useState<Runner>(() => createRunner())
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

  const reset = useCallback(() => {
    setRunner(createRunner())
    setVersion((v) => v + 1)
  }, [])

  return { snapshot, apply, reset }
}
