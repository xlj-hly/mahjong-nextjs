// HTTP 层：cors/日志/健康检查；未来 REST API 统一挂载在 /api 前缀下。

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

export function createHonoApp(): Hono {
  const app = new Hono()
  app.use('*', logger())
  app.use('*', cors())
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // 反向代理按 /api/ 分流到本服务
  const api = new Hono()
  app.route('/api', api)

  return app
}
