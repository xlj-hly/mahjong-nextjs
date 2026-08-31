'use client'

// 房间视图：创建/加入房间 UI，准备/开局，以及联机对局中的棋盘。

import { useState, useEffect } from 'react'
import type { NetworkRunner } from '@mahjong/protocol'
import { seatName, type Action, type Snapshot } from '@mahjong/game-core'
import { RULES } from './useHotseatGame'

interface RoomViewProps {
  runner: NetworkRunner
  onBack: () => void
}

export function RoomView({ runner, onBack }: RoomViewProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    return runner.onUpdate(() => setTick((v) => v + 1))
  }, [runner])

  // 对局已开始且有快照 → 显示棋盘
  if (runner.started && runner.snapshot) {
    return (
      <OnlineBoard runner={runner} snapshot={runner.snapshot} onBack={onBack} />
    )
  }

  // 在房间中（未开始）→ 显示房间界面
  if (runner.roomCode) {
    return (
      <div className="board">
        <header className="board__header">
          <h1>房间 {runner.roomCode}</h1>
          <p>
            规则：
            {RULES.find((r) => r.id === runner.rule)?.label ?? runner.rule}
          </p>
        </header>
        <section>
          <h2>成员</h2>
          <ul>
            {runner.members.map((m) => (
              <li key={m.seat}>
                {seatName(m.seat as 0 | 1 | 2 | 3)}
                {m.seat === 0 && ' (房主)'}
                {m.ready ? ' ✓ 已准备' : ' 等待中'}
              </li>
            ))}
          </ul>
          {runner.members.length < 4 && (
            <p>等待更多玩家加入…（分享房间码：{runner.roomCode}）</p>
          )}
        </section>
        <div className="board__actions">
          <button type="button" onClick={() => runner.ready()}>
            准备
          </button>
          {runner.members.length === 4 && (
            <button type="button" onClick={() => runner.start()}>
              开局
            </button>
          )}
          <button type="button" onClick={onBack}>
            返回
          </button>
        </div>
        {runner.error && <p style={{ color: 'red' }}>{runner.error}</p>}
      </div>
    )
  }

  // 未在房间中 → 创建/加入
  return <CreateJoinView runner={runner} onBack={onBack} />
}

function CreateJoinView({
  runner,
  onBack,
}: {
  runner: NetworkRunner
  onBack: () => void
}) {
  const [rule, setRule] = useState('guobiao')
  const [joinCode, setJoinCode] = useState('')

  return (
    <div className="board">
      <header className="board__header">
        <h1>联机对战</h1>
      </header>
      <section>
        <h2>创建房间</h2>
        <div className="board__rule-select">
          <span>选择规则：</span>
          {RULES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === rule ? 'board__rule-active' : ''}
              onClick={() => setRule(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => runner.createRoom(rule)}>
          创建房间
        </button>
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>加入房间</h2>
        <input
          type="text"
          placeholder="输入房间码"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
          style={{
            padding: '8px 12px',
            fontSize: 16,
            textTransform: 'uppercase',
            width: 120,
            marginRight: 8,
          }}
        />
        <button
          type="button"
          onClick={() => joinCode && runner.joinRoom(joinCode)}
          disabled={joinCode.length < 6}
        >
          加入
        </button>
      </section>
      <div className="board__actions" style={{ marginTop: 24 }}>
        <button type="button" onClick={onBack}>
          返回
        </button>
      </div>
      {runner.error && <p style={{ color: 'red' }}>{runner.error}</p>}
      {runner.connectionState === 'disconnected' && (
        <p style={{ color: '#666' }}>未连接到服务器</p>
      )}
    </div>
  )
}

function OnlineBoard({
  runner,
  snapshot,
  onBack,
}: {
  runner: NetworkRunner
  snapshot: Snapshot
  onBack: () => void
}) {
  // 复用 BoardView 的展示逻辑，但 apply 走网络
  // 这里直接用一个轻量的在线棋盘，将 apply 转发给 runner
  return (
    <div className="board">
      <header className="board__header">
        <h1>
          联机对战 ·{' '}
          {RULES.find((r) => r.id === runner.rule)?.label ?? runner.rule}
        </h1>
        <p>
          房间 {runner.roomCode} · 座位 {seatName(snapshot.seat)} · 剩余{' '}
          {snapshot.wallRemaining} 张
        </p>
      </header>
      <OnlineBoardInner runner={runner} snapshot={snapshot} />
      {runner.error && <p style={{ color: 'red' }}>{runner.error}</p>}
      <div className="board__actions">
        <button type="button" onClick={onBack}>
          返回
        </button>
      </div>
    </div>
  )
}

function OnlineBoardInner({
  runner,
  snapshot: initialSnapshot,
}: {
  runner: NetworkRunner
  snapshot: Snapshot
}) {
  const [selected, setSelected] = useState<number | null>(null)
  // 使用 runner.snapshot 作为最新快照
  const snapshot = runner.snapshot ?? initialSnapshot

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
      runner.apply(action)
      setSelected(null)
    }
  }

  // 和 BoardView 共用相同的渲染逻辑
  if (snapshot.phase === 'voidSuit') {
    return (
      <section className="board__voidsuit">
        <h2>{seatName(snapshot.seat)} 定缺</h2>
        <div className="board__actions">
          {snapshot.legalActions
            .filter((a) => a.type === 'voidSuit')
            .map((a, i) => (
              <button key={i} type="button" onClick={() => runner.apply(a)}>
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
              {seatName(snapshot.winner)} 和牌！
              {snapshot.winInfo.totalFan} 番
            </h2>
            <ul>
              {snapshot.winInfo.fan.map((f) => (
                <li key={f.name}>
                  {f.name}（{f.value} 番）
                </li>
              ))}
            </ul>
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
              <div className="board__opponent-name">
                {seatName(s as 0 | 1 | 2 | 3)}
              </div>
              <div className="board__hand">
                {snapshot.hands[s].concealedCount > 0
                  ? Array.from({
                      length: snapshot.hands[s].concealedCount,
                    }).map((_, i) => (
                      <span key={i} className="tile tile--back" />
                    ))
                  : null}
                {snapshot.hands[s].flowers.map((f, i) => (
                  <span key={`f${i}`} className="tile tile--flower">
                    {tileLabel(f)}
                  </span>
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
                {seatName(seat as 0 | 1 | 2 | 3)}：
              </span>
              {discards.map((d, i) => (
                <span
                  key={i}
                  className={`tile tile--${d.suit}`}
                  style={{ fontSize: 14, width: 32, height: 44 }}
                >
                  {tileLabel(d)}
                </span>
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
            <button
              key={i}
              type="button"
              className={`tile tile--${t.suit}${selected === i ? ' tile--selected' : ''}${discardAction ? ' tile--clickable' : ''}`}
              onClick={
                discardAction
                  ? () => setSelected(selected === i ? null : i)
                  : undefined
              }
            >
              {tileLabel(t)}
            </button>
          ))}
        </div>
        <div className="board__actions">
          {discardAction && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={selected === null}
            >
              出牌
            </button>
          )}
          {claimActions.map((a, i) => (
            <button key={i} type="button" onClick={() => runner.apply(a)}>
              {actionLabel(a)}
            </button>
          ))}
          {snapshot.legalActions.some((a) => a.type === 'draw') && (
            <button
              type="button"
              onClick={() => runner.apply({ type: 'draw' })}
            >
              摸牌
            </button>
          )}
        </div>
      </section>
    </>
  )
}

// 复用 BoardView 中的辅助函数
import { tileLabel, type Meld, type Suit } from '@mahjong/game-core'

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
