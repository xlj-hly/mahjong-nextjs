'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useRoom } from '@/hooks/useRoom'

const RoomView = dynamic(
  () => import('@/components/RoomView').then((mod) => mod.RoomView),
  {
    ssr: false,
    loading: () => <div className="board">连接中…</div>,
  },
)

export default function RoomPage() {
  const router = useRouter()
  const params = useParams<{ code: string }>()
  const code = params.code
  const runner = useRoom(process.env.NEXT_PUBLIC_SERVER_URL)

  // 凭 URL 中的房间码自动加入
  useEffect(() => {
    if (code) runner.joinRoom(code)
  }, [code, runner])

  return <RoomView runner={runner} onBack={() => router.push('/online')} />
}
