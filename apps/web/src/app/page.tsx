'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createNetworkRunner } from '@mahjong/protocol'
import '@/components/board.css'

// 对局依赖随机洗牌，禁用 SSR 避免 hydration 不一致。
const BoardView = dynamic(
  () => import('@/components/BoardView').then((mod) => mod.BoardView),
  {
    ssr: false,
    loading: () => <div className="board">加载对局…</div>,
  },
)

const RoomView = dynamic(
  () => import('@/components/RoomView').then((mod) => mod.RoomView),
  {
    ssr: false,
    loading: () => <div className="board">连接中…</div>,
  },
)

type Mode = 'menu' | 'hotseat' | 'online'

export default function Home() {
  const [mode, setMode] = useState<Mode>('menu')

  if (mode === 'hotseat') {
    return <BoardView />
  }

  if (mode === 'online') {
    return <RoomViewWrapper onBack={() => setMode('menu')} />
  }

  return (
    <div className="board">
      <header className="board__header">
        <h1>麻将</h1>
        <p>选择对局模式</p>
      </header>
      <div className="board__actions">
        <button type="button" onClick={() => setMode('hotseat')}>
          本地热座
        </button>
        <button type="button" onClick={() => setMode('online')}>
          联机对战
        </button>
      </div>
    </div>
  )
}

function RoomViewWrapper({ onBack }: { onBack: () => void }) {
  const serverUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001'
  const runner = useMemo(() => createNetworkRunner(serverUrl), [serverUrl])

  return <RoomView runner={runner} onBack={onBack} />
}
