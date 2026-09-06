import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from './client'

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功时返回解析后的 JSON 数据', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ hello: 'world' }),
      }),
    )

    const result = await request<{ hello: string }>('/api/health')
    expect(result).toEqual({ ok: true, data: { hello: 'world' } })
  })

  it('非 2xx 时归一为错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
    )

    const result = await request('/api/missing')
    expect(result).toEqual({ ok: false, status: 404, message: 'HTTP 404' })
  })

  it('网络错误归一', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    const result = await request('/api/x')
    expect(result).toEqual({ ok: false, status: 0, message: 'boom' })
  })
})
