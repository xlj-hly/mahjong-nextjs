// HTTP 客户端封装骨架：base URL、JSON 解析、错误归一、超时。暂不接真实 REST 端点。

export interface ClientOptions {
  /** 服务端根地址；缺省时同源。 */
  baseUrl?: string
  /** 超时毫秒数，默认 10000。 */
  timeoutMs?: number
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

/** 发起 GET 请求并把成功/失败归一到 ApiResult。 */
export async function request<T>(
  path: string,
  opts: ClientOptions = {},
): Promise<ApiResult<T>> {
  const baseUrl = opts.baseUrl ?? ''
  const timeoutMs = opts.timeoutMs ?? 10000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      return { ok: false, status: res.status, message: `HTTP ${res.status}` }
    }
    const data = (await res.json()) as T
    return { ok: true, data }
  } catch (err) {
    if (controller.signal.aborted) {
      return { ok: false, status: 0, message: '请求超时' }
    }
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : '网络错误',
    }
  } finally {
    clearTimeout(timer)
  }
}
