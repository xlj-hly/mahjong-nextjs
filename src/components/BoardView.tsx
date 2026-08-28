'use client'

// 棋盘视图层（BoardView）：桌面/手牌/牌河的布局与交互。
// 只消费 snapshot、只上报意图，不含合法性或番数判断逻辑。

import { useState } from 'react'
import type { Action } from '@/game/core/state-machine'
import { seatName } from '@/game/core/state-machine'
import type { Seat } from '@/game/core/rules-plugin'
import type { Meld } from '@/game/core/decompose'
import { tileLabel, type Suit } from '@/game/core/tile'
import { TileView } from './TileView'
import { useHotseatGame, RULES } from './useHotseatGame'

function voidSuitLabel(action: Action): string {
  const suit = action.type === 'voidSuit' ? action.suit : null
  const names: Record<Suit, string> = {
    wan: '万',
    tong: '筒',
    tiao: '条',
    wind: '风',
    dragon: '箭',
    flower: '花',
  }
  return suit ? names[suit] : ''
}

function actionLabel(action: Action): string {
  switch (action.type) {
    case 'voidSuit':
      return '定缺'
    case 'draw':
      return '摸牌'
    case 'win':
      return '和牌'
    case 'pong':
      return '碰'
    case 'kong':
      return '杠'
    case 'chow':
      return '吃'
    case 'pass':
      return '过'
    case 'discard':
      return '出牌'
  }
}

function meldLabel(meld: Meld): string {
  if (meld.type === 'chow') return `吃 ${meld.tiles.map(tileLabel).join('')}`
  if (meld.type === 'pung') return `碰 ${tileLabel(meld.tile)}`
  return `${meld.concealed ? '暗' : '明'}杠 ${tileLabel(meld.tile)}`
}

export function BoardView() {
  const { snapshot, apply, reset, ruleId } = useHotseatGame()
  const [selected, setSelected] = useState<number | null>(null)

  const ruleLabel = RULES.find((r) => r.id === ruleId)?.label ?? ruleId
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
      apply(action)
      setSelected(null)
    }
  }

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
        <div className="board__rule-select">
          <span>选择规则：</span>
          {RULES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === ruleId ? 'board__rule-active' : ''}
              onClick={() => reset(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {snapshot.phase === 'voidSuit' ? (
        <section className="board__voidsuit">
          <h2>{seatName(snapshot.seat)} 定缺（选一门本局不要的花色）</h2>
          <div className="board__actions">
            {snapshot.legalActions
              .filter((a) => a.type === 'voidSuit')
              .map((a, i) => (
                <button key={i} type="button" onClick={() => apply(a)}>
                  缺 {voidSuitLabel(a)}
                </button>
              ))}
          </div>
        </section>
      ) : snapshot.phase === 'ended' ? (
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
          <button type="button" onClick={() => reset()}>
            重新开局
          </button>
        </section>
      ) : (
        <>
          <section className="board__others">
            {[0, 1, 2, 3]
              .filter((s) => s !== snapshot.seat)
              .map((s) => (
                <div key={s} className="board__opponent">
                  <div className="board__opponent-name">
                    {seatName(s as Seat)}
                  </div>
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
                <button key={i} type="button" onClick={() => apply(a)}>
                  {actionLabel(a)}
                </button>
              ))}
              {snapshot.legalActions.some((a) => a.type === 'draw') && (
                <button type="button" onClick={() => apply({ type: 'draw' })}>
                  摸牌
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
