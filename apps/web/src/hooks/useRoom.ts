'use client'

// 联机房间状态容器：封装 NetworkRunner 生命周期，订阅 onUpdate 触发重渲染，卸载时断开。

import { useEffect, useMemo, useState } from 'react'
import { createNetworkRunner, type NetworkRunner } from '@/api/socket'

export function useRoom(url?: string): NetworkRunner {
  const runner = useMemo(() => createNetworkRunner({ url }), [url])
  const [, setTick] = useState(0)

  useEffect(() => {
    const unsubscribe = runner.onUpdate(() => setTick((v) => v + 1))
    return () => {
      unsubscribe()
      runner.disconnect()
    }
  }, [runner])

  return runner
}
