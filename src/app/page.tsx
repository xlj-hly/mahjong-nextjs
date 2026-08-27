'use client'

import dynamic from 'next/dynamic'
import '@/components/board.css'

// 对局依赖随机洗牌，禁用 SSR 避免 hydration 不一致。
const BoardView = dynamic(
  () => import('@/components/BoardView').then((mod) => mod.BoardView),
  {
    ssr: false,
    loading: () => <div className="board">加载对局…</div>,
  },
)

export default function Home() {
  return <BoardView />
}
