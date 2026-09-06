// Hono + Socket.io 服务入口：组装 HTTP 层、房间存储、对局编排、实时通信层。
// 保留 createApp() 工厂，返回不监听的 { httpServer, io }，供集成测试自定义端口。

import { createAdaptorServer } from '@hono/node-server'
import { createHonoApp } from './routes/app'
import { createGameService } from './services/game'
import { createRoomStore } from './store/room-store'
import { createSocketServer } from './socket/server'

const PORT = Number(process.env.PORT ?? 3001)

export function createApp() {
  const app = createHonoApp()
  const httpServer = createAdaptorServer({ fetch: app.fetch })
  const store = createRoomStore()
  const game = createGameService(store)
  const io = createSocketServer(httpServer, store, game)

  return { httpServer, io }
}

// 直接执行时启动服务（tsx 下 import.meta.url 含 query string，用 includes 匹配）
const isMain = import.meta.url.includes(
  process.argv[1]?.replace(/\\/g, '/') ?? '__none__',
)
if (isMain) {
  const { httpServer } = createApp()
  httpServer.listen(PORT, () => {
    console.log(`麻将服务已启动: http://localhost:${PORT}`)
  })
}
