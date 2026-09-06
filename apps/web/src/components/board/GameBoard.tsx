'use client'

// 纯展示棋盘：只消费 snapshot、只回调 onApply 上报意图，不含数据获取与规则逻辑。
// 热座与联机共用，仅数据来源不同。

import { useState } from 'react'
import {
  seatName,
  tileLabel,
  type Action,
  type Seat,
  type Snapshot,
} from '@mahjong/game-core'
import { TileView } from '../TileView'
import { actionLabel, meldLabel, voidSuitLabel } from '@/lib/labels'

export function GameBoard({
  snapshot,
  onApply,
}: {
  snapshot: Snapshot
  onApply: (action: Action) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)

  const hand = snapshot.hands[snapshot.seat]
  const discardAction = snapshot.legalActions.find((a) => a.type === 'discard')
  const claimActions = snapshot.legalActions.filter(
    (a) => a.type !== 'discard' && a.type !== 'draw',
  )

  function onDiscard() {
    if (selected === null || !hand.concealed) return
    const tile = hand.concealed[selected]
    const action = snapshot.legalActions.find(
      (a) =>
        a.type === 'discard' &&
        a.tile.suit === tile.suit &&
        a.tile.rank === tile.rank,
    )
    if (action) {
      onApply(action)
      setSelected(null)
    }
  }

  if (snapshot.phase === 'voidSuit') {
    return (
      <section className="board__voidsuit">
        <h2>{seatName(snapshot.seat)} 定缺（选一门本局不要的花色）</h2>
        <div className="board__actions">
          {snapshot.legalActions
            .filter((a) => a.type === 'voidSuit')
            .map((a, i) => (
              <button key={i} type="button" onClick={() => onApply(a)}>
                缺 {voidSuitLabel(a)}
              </button>
            ))}
        </div>
      </section>
    )
  }

  if (snapshot.phase === 'ended') {
    return (
      <section className="board__result">
        {snapshot.winner !== null && snapshot.winInfo ? (
          <>
            <h2>
              {seatName(snapshot.winner)} 和牌！{snapshot.winInfo.totalFan} 番
            </h2>
            <ul>
              {snapshot.winInfo.fan.map((f) => (
                <li key={f.name}>
                  {f.name}（{f.value} 番）
                </li>
              ))}
            </ul>
            {snapshot.score && snapshot.score.payments.length > 0 && (
              <div>
                {snapshot.score.payments.map((p, i) => (
                  <p key={i}>
                    座位 {p.from} → 座位 {p.to}：{p.points} 分
                  </p>
                ))}
              </div>
            )}
          </>
        ) : (
          <h2>荒庄（流局）</h2>
        )}
      </section>
    )
  }

  return (
    <>
      <section className="board__others">
        {[0, 1, 2, 3]
          .filter((s) => s !== snapshot.seat)
          .map((s) => (
            <div key={s} className="board__opponent">
              <div className="board__opponent-name">{seatName(s as Seat)}</div>
              <div className="board__hand">
                {snapshot.hands[s].concealedCount > 0
                  ? Array.from({
                      length: snapshot.hands[s].concealedCount,
                    }).map((_, i) => <TileView key={i} faceDown />)
                  : null}
                {snapshot.hands[s].flowers.map((f, i) => (
                  <TileView key={`f${i}`} tile={f} />
                ))}
              </div>
              <div className="board__melds">
                {snapshot.hands[s].melds.map((m, i) => (
                  <span key={i} className="board__meld">
                    {meldLabel(m)}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </section>

      <section className="board__discard">
        {snapshot.discards.map((discards, seat) =>
          discards.length > 0 ? (
            <div key={seat} className="board__discard-row">
              <span className="board__discard-seat">
                {seatName(seat as Seat)}：
              </span>
              {discards.map((d, i) => (
                <TileView key={i} tile={d} />
              ))}
            </div>
          ) : null,
        )}
      </section>

      <section className="board__self">
        <div className="board__melds">
          {hand.melds.map((m, i) => (
            <span key={i} className="board__meld">
              {meldLabel(m)}
            </span>
          ))}
          {hand.flowers.map((f, i) => (
            <span key={`fl${i}`} className="board__meld">
              花 {tileLabel(f)}
            </span>
          ))}
        </div>
        <div className="board__hand">
          {hand.concealed?.map((t, i) => (
            <TileView
              key={i}
              tile={t}
              selected={selected === i}
              onClick={
                discardAction
                  ? () => setSelected(selected === i ? null : i)
                  : undefined
              }
            />
          ))}
        </div>
        <div className="board__actions">
          {discardAction && (
            <button type="button" onClick={onDiscard} disabled={!selected}>
              出牌
            </button>
          )}
          {claimActions.map((a, i) => (
            <button key={i} type="button" onClick={() => onApply(a)}>
              {actionLabel(a)}
            </button>
          ))}
          {snapshot.legalActions.some((a) => a.type === 'draw') && (
            <button type="button" onClick={() => onApply({ type: 'draw' })}>
              摸牌
            </button>
          )}
        </div>
      </section>
    </>
  )
}
