'use client'

// 房间视图：创建/加入房间 UI，准备/开局，以及联机对局中的棋盘。

import { useState } from 'react'
import type { NetworkRunner } from '@/api/socket'
import type { RuleId } from '@mahjong/protocol'
import { seatName, type Snapshot } from '@mahjong/game-core'
import { RuleSelect } from '@/components/ui/RuleSelect'
import { RULES } from '@/lib/rules'
import { GameBoard } from './board/GameBoard'

interface RoomViewProps {
  runner: NetworkRunner
  onBack: () => void
}

export function RoomView({ runner, onBack }: RoomViewProps) {
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
                {seatName(m.seat)}
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
  const [rule, setRule] = useState<RuleId>('guobiao')
  const [joinCode, setJoinCode] = useState('')

  return (
    <div className="board">
      <header className="board__header">
        <h1>联机对战</h1>
      </header>
      <section>
        <h2>创建房间</h2>
        <RuleSelect value={rule} onChange={setRule} />
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
      <GameBoard snapshot={snapshot} onApply={runner.apply} />
      {runner.error && <p style={{ color: 'red' }}>{runner.error}</p>}
      <div className="board__actions">
        <button type="button" onClick={onBack}>
          返回
        </button>
      </div>
    </div>
  )
}
