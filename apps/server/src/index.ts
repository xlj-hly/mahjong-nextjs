// Hono + Socket.io 服务入口：HTTP 层（cors/日志/健康检查）+ 实时通信层（房间/意图处理）。
// 保留 createApp() 工厂，返回不监听的 { httpServer, io }，供集成测试自定义端口。

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createAdaptorServer } from '@hono/node-server'
import { Server, type Socket } from 'socket.io'
import {
  createRoom,
  joinRoom,
  setReady,
  startGame,
  getRoomMembers,
  getRoom,
  findRoomBySocket,
  getSeat,
} from './room'
import {
  createRunner,
  guobiao,
  sichuan,
  type Runner,
  type RulesPlugin,
  type Seat,
} from '@mahjong/game-core'
import type { ClientMessage, ServerMessage } from '@mahjong/protocol'

const RULES: Record<string, RulesPlugin> = { guobiao, sichuan }

const PORT = Number(process.env.PORT ?? 3001)
const runners = new Map<string, Runner>()

const app = new Hono()
app.use('*', logger())
app.use('*', cors())
app.get('/health', (c) => c.json({ status: 'ok' }))

function broadcastRoom(code: string, io: Server): void {
  const room = getRoom(code)
  if (!room) return
  const members = getRoomMembers(code)
  for (const [socketId, member] of room.members) {
    const msg: ServerMessage = {
      type: 'room',
      code,
      members,
      rule: room.rule,
      started: room.started,
      yourSeat: member.seat,
    }
    io.to(socketId).emit('message', msg)
  }
}

function broadcastSnapshots(code: string, io: Server): void {
  const runner = runners.get(code)
  if (!runner) return
  const room = getRoom(code)
  if (!room) return
  for (const [socketId, member] of room.members) {
    const snapshot = runner.snapshot(member.seat as Seat)
    const msg: ServerMessage = { type: 'snapshot', snapshot }
    io.to(socketId).emit('message', msg)
  }
}

function broadcastGameOver(code: string, io: Server): void {
  const runner = runners.get(code)
  if (!runner) return
  const room = getRoom(code)
  if (!room) return
  for (const [socketId, member] of room.members) {
    const snapshot = runner.snapshot(member.seat as Seat)
    const msg: ServerMessage = { type: 'gameOver', snapshot }
    io.to(socketId).emit('message', msg)
  }
}

function handleMessage(socket: Socket, data: ClientMessage, io: Server): void {
  switch (data.type) {
    case 'create': {
      const code = createRoom(socket.id, data.rule)
      socket.join(code)
      const msg: ServerMessage = {
        type: 'room',
        code,
        members: getRoomMembers(code),
        rule: data.rule,
        started: false,
        yourSeat: 0,
      }
      socket.emit('message', msg)
      break
    }

    case 'join': {
      const err = joinRoom(data.code, socket.id)
      if (err) {
        socket.emit('message', {
          type: 'error',
          message: err,
        } as ServerMessage)
        return
      }
      socket.join(data.code)
      broadcastRoom(data.code, io)
      break
    }

    case 'ready': {
      const room = findRoomBySocket(socket.id)
      if (!room) {
        socket.emit('message', {
          type: 'error',
          message: '不在房间中',
        } as ServerMessage)
        return
      }
      const err = setReady(room.code, socket.id)
      if (err) {
        socket.emit('message', {
          type: 'error',
          message: err,
        } as ServerMessage)
        return
      }
      broadcastRoom(room.code, io)
      break
    }

    case 'start': {
      const room = findRoomBySocket(socket.id)
      if (!room) {
        socket.emit('message', {
          type: 'error',
          message: '不在房间中',
        } as ServerMessage)
        return
      }
      const err = startGame(room.code, socket.id)
      if (err) {
        socket.emit('message', {
          type: 'error',
          message: err,
        } as ServerMessage)
        return
      }

      // 创建对局引擎
      const plugin = RULES[room.rule] ?? guobiao
      const runner = createRunner(plugin)
      runners.set(room.code, runner)
      broadcastRoom(room.code, io)
      broadcastSnapshots(room.code, io)
      break
    }

    case 'action': {
      const room = findRoomBySocket(socket.id)
      if (!room || !room.started) {
        socket.emit('message', {
          type: 'error',
          message: '对局未开始',
        } as ServerMessage)
        return
      }
      const runner = runners.get(room.code)
      if (!runner) {
        socket.emit('message', {
          type: 'error',
          message: '对局引擎未初始化',
        } as ServerMessage)
        return
      }
      const seat = getSeat(room.code, socket.id)
      if (seat === null) {
        socket.emit('message', {
          type: 'error',
          message: '座位信息错误',
        } as ServerMessage)
        return
      }
      try {
        runner.apply(seat as Seat, data.action)
      } catch (err) {
        socket.emit('message', {
          type: 'error',
          message: err instanceof Error ? err.message : '非法操作',
        } as ServerMessage)
        return
      }
      if (runner.isOver()) {
        broadcastGameOver(room.code, io)
      } else {
        broadcastSnapshots(room.code, io)
      }
      break
    }
  }
}

export function createApp() {
  const httpServer = createAdaptorServer({ fetch: app.fetch })
  const io = new Server(httpServer, { cors: { origin: '*' } })

  io.on('connection', (socket) => {
    console.log(`[连接] ${socket.id}`)

    socket.on('message', (data: ClientMessage) => {
      try {
        handleMessage(socket, data, io)
      } catch (err) {
        const msg: ServerMessage = {
          type: 'error',
          message: err instanceof Error ? err.message : '未知错误',
        }
        socket.emit('message', msg)
      }
    })

    socket.on('disconnect', () => {
      console.log(`[断开] ${socket.id}`)
      const room = findRoomBySocket(socket.id)
      if (room && !room.started) {
        room.members.delete(socket.id)
        socket.leave(room.code)
        broadcastRoom(room.code, io)
      }
    })
  })

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
