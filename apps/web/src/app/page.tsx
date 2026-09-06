'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div className="board">
      <header className="board__header">
        <h1>麻将</h1>
        <p>选择对局模式</p>
      </header>
      <div className="board__actions">
        <button type="button" onClick={() => router.push('/hotseat')}>
          本地热座
        </button>
        <button type="button" onClick={() => router.push('/online')}>
          联机对战
        </button>
      </div>
    </div>
  )
}
