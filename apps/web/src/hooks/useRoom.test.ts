import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoom } from './useRoom'

const mocks = vi.hoisted(() => ({
  createNetworkRunner: vi.fn(),
  onUpdate: vi.fn(() => () => {}),
  disconnect: vi.fn(),
}))

vi.mock('@/api/socket', () => ({
  createNetworkRunner: mocks.createNetworkRunner,
}))

describe('useRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createNetworkRunner.mockReturnValue({
      onUpdate: mocks.onUpdate,
      disconnect: mocks.disconnect,
    })
  })

  it('创建 runner 并订阅 onUpdate，卸载时断开连接', () => {
    const { unmount } = renderHook(() => useRoom('http://localhost:3001'))

    expect(mocks.createNetworkRunner).toHaveBeenCalledWith({
      url: 'http://localhost:3001',
    })
    expect(mocks.onUpdate).toHaveBeenCalledTimes(1)

    unmount()
    expect(mocks.disconnect).toHaveBeenCalledTimes(1)
  })
})
