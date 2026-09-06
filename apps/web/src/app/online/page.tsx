'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useRoom } from '@/hooks/useRoom'

const RoomView = dynamic(
  () => import('@/components/RoomView').then((mod) => mod.RoomView),
  {
    ssr: false,
    loading: () => <div className="board">连接中…</div>,
  },
)

export default function OnlinePage() {
  const router = useRouter()
  const runner = useRoom(process.env.NEXT_PUBLIC_SERVER_URL)

  return <RoomView runner={runner} onBack={() => router.push('/')} />
}
