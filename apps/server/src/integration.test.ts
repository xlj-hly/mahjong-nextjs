// 服务端集成测试：模拟 4 名玩家通过 Socket.io 完成一局对局。

import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { createApp } from './index'
import { resetRooms } from './room'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import type { Server } from 'socket.io'
import type { ServerMessage } from '@mahjong/protocol'
import type { Snapshot } from '@mahjong/game-core'

const PORT = 3099

function createClient(): ClientSocket {
  return ioClient(`http://localhost:${PORT}`, {
    transports: ['websocket'],
    forceNew: true,
  })
}

function waitForMessage(
  socket: ClientSocket,
  type: string,
  timeout = 3000,
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for ${type}`)),
      timeout,
    )
    const handler = (msg: ServerMessage) => {
      if (msg.type === type) {
        clearTimeout(timer)
        socket.off('message', handler)
        resolve(msg)
      }
    }
    socket.on('message', handler)
  })
}

function send(socket: ClientSocket, msg: unknown): void {
  socket.emit('message', msg)
}

describe('服务端集成测试', () => {
  let httpServer: ReturnType<typeof createApp>['httpServer']
  let io: Server

  beforeAll(async () => {
    const app = createApp()
    httpServer = app.httpServer
    io = app.io
    await new Promise<void>((resolve) => httpServer.listen(PORT, resolve))
  })

  afterAll(async () => {
    io.close()
    httpServer.close()
  })

  beforeEach(() => {
    resetRooms()
  })

  it('4 名玩家加入 → 准备 → 开局 → 出牌流转 → 和牌结算（国标）', async () => {
    const clients: ClientSocket[] = []
    for (let i = 0; i < 4; i++) {
      clients.push(createClient())
    }

    try {
      // 等待所有客户端连接
      await Promise.all(
        clients.map(
          (c) =>
            new Promise<void>((resolve) => c.on('connect', () => resolve())),
        ),
      )

      // 房主创建房间
      send(clients[0], { type: 'create', rule: 'guobiao' })
      const roomMsg = (await waitForMessage(clients[0], 'room')) as Extract<
        ServerMessage,
        { type: 'room' }
      >
      expect(roomMsg.code).toHaveLength(6)
      expect(roomMsg.yourSeat).toBe(0)
      const code = roomMsg.code

      // 其他 3 人加入
      for (let i = 1; i < 4; i++) {
        send(clients[i], { type: 'join', code })
        await waitForMessage(clients[i], 'room')
      }

      // 全员准备
      for (let i = 0; i < 4; i++) {
        send(clients[i], { type: 'ready' })
        await waitForMessage(clients[i], 'room')
      }

      // 房主开局
      send(clients[0], { type: 'start' })

      // 每人应收到初始快照
      const snapshots: Snapshot[] = []
      for (let i = 0; i < 4; i++) {
        const snapMsg = (await waitForMessage(
          clients[i],
          'snapshot',
        )) as Extract<ServerMessage, { type: 'snapshot' }>
        snapshots.push(snapMsg.snapshot)
        expect(snapMsg.snapshot.seat).toBe(i)
      }

      // 自动出牌直到对局结束（最多 200 步）
      let steps = 0
      let gameOver = false
      while (steps < 200 && !gameOver) {
        // 找到当前行动者
        const overview = snapshots[0]
        const actor = (overview.activeClaimer ?? overview.current) as number
        const actorSnap = snapshots[actor]
        if (!actorSnap || actorSnap.legalActions.length === 0) break

        // 选择第一个合法动作
        const action = actorSnap.legalActions[0]
        send(clients[actor], { type: 'action', action })

        // 等待所有玩家收到更新
        const promises = clients.map((c) =>
          Promise.race([
            waitForMessage(c, 'snapshot').then((m) => {
              const snapMsg = m as Extract<ServerMessage, { type: 'snapshot' }>
              return snapMsg.snapshot
            }),
            waitForMessage(c, 'gameOver').then((m) => {
              gameOver = true
              const goMsg = m as Extract<ServerMessage, { type: 'gameOver' }>
              return goMsg.snapshot
            }),
          ]),
        )

        const newSnapshots = await Promise.all(promises)
        for (let i = 0; i < 4; i++) {
          if (newSnapshots[i]) snapshots[i] = newSnapshots[i]
        }
        steps++
      }

      // 对局应该结束了（和牌或荒庄）
      expect(snapshots[0].phase).toBe('ended')
    } finally {
      for (const c of clients) c.disconnect()
    }
  }, 30000)

  it('非法意图被拒绝，不推进对局', async () => {
    const clients: ClientSocket[] = []
    for (let i = 0; i < 4; i++) {
      clients.push(createClient())
    }

    try {
      await Promise.all(
        clients.map(
          (c) =>
            new Promise<void>((resolve) => c.on('connect', () => resolve())),
        ),
      )

      send(clients[0], { type: 'create', rule: 'guobiao' })
      const roomMsg = (await waitForMessage(clients[0], 'room')) as Extract<
        ServerMessage,
        { type: 'room' }
      >
      const code = roomMsg.code

      for (let i = 1; i < 4; i++) {
        send(clients[i], { type: 'join', code })
        await waitForMessage(clients[i], 'room')
      }

      for (let i = 0; i < 4; i++) {
        send(clients[i], { type: 'ready' })
        await waitForMessage(clients[i], 'room')
      }

      send(clients[0], { type: 'start' })
      const initialSnaps: Snapshot[] = []
      for (let i = 0; i < 4; i++) {
        const snapMsg = (await waitForMessage(
          clients[i],
          'snapshot',
        )) as Extract<ServerMessage, { type: 'snapshot' }>
        initialSnaps.push(snapMsg.snapshot)
      }

      // 非当前行动者尝试出牌，应收到错误
      const current = initialSnaps[0].current
      const wrongPlayer = (current + 1) % 4

      send(clients[wrongPlayer], {
        type: 'action',
        action: { type: 'draw' },
      })

      const errMsg = (await waitForMessage(
        clients[wrongPlayer],
        'error',
      )) as Extract<ServerMessage, { type: 'error' }>
      expect(errMsg.message).toBeTruthy()
    } finally {
      for (const c of clients) c.disconnect()
    }
  }, 15000)
})
