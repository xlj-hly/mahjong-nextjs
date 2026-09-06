'use client'

// 热座对局视图：持有本地运行器，头部展示规则/座位，棋盘交给 GameBoard。

import { seatName } from '@mahjong/game-core'
import { RuleSelect } from '@/components/ui/RuleSelect'
import { useHotseatGame } from '@/hooks/useHotseatGame'
import { RULES } from '@/lib/rules'
import { GameBoard } from './board/GameBoard'

export function BoardView() {
  const { snapshot, apply, reset, ruleId } = useHotseatGame()

  const ruleLabel = RULES.find((r) => r.id === ruleId)?.label ?? ruleId

  return (
    <div className="board">
      <header className="board__header">
        <h1>{ruleLabel} · 热座</h1>
        <p>
          当前：<strong>{seatName(snapshot.seat)}</strong>
          {snapshot.activeClaimer !== null && (
            <> · 待响应：{seatName(snapshot.activeClaimer)}</>
          )}{' '}
          · 剩余 {snapshot.wallRemaining} 张
        </p>
        <RuleSelect value={ruleId} onChange={reset} />
      </header>

      <GameBoard snapshot={snapshot} onApply={apply} />

      {snapshot.phase === 'ended' && (
        <div className="board__actions">
          <button type="button" onClick={() => reset()}>
            重新开局
          </button>
        </div>
      )}
    </div>
  )
}
