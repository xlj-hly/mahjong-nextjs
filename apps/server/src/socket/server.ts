// Socket.io 层：初始化 + 消息分发，把客户端意图转成 store/services 调用。
// 广播走逐 socket 直连（io.to(socketId)）：快照是每座位独立视角，不使用 socket.io 房间信道。

import type { ServerType } from '@hono/node-server'
import { Server, type Socket } from 'socket.io'
import type { ClientMessage, ServerMessage } from '@mahjong/protocol'
import type { GameService } from '../services/game'
import type { RoomStore } from '../store/room-store'

export function createSocketServer(
  httpServer: ServerType,
  store: RoomStore,
  game: GameService,
): Server {
  // path '/ws'：让反向代理能以统一前缀 /ws/ 分流 WebSocket 流量（客户端须使用相同 path）
  const io = new Server(httpServer, { path: '/ws', cors: { origin: '*' } })

  io.on('connection', (socket) => {
    console.log(`[连接] ${socket.id}`)

    socket.on('message', (data: ClientMessage) => {
      try {
        handleMessage(socket, data, io, store, game)
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
      const room = store.findRoomBySocket(socket.id)
      if (room && !room.started) {
        store.leaveRoom(room.code, socket.id)
        game.broadcastRoom(room.code, io)
      }
    })
  })

  return io
}

function handleMessage(
  socket: Socket,
  data: ClientMessage,
  io: Server,
  store: RoomStore,
  game: GameService,
): void {
  switch (data.type) {
    case 'create': {
      const code = store.createRoom(socket.id, data.rule)
      game.broadcastRoom(code, io)
      break
    }

    case 'join': {
      const err = store.joinRoom(data.code, socket.id)
      if (err) {
        socket.emit('message', {
          type: 'error',
          message: err,
        } as ServerMessage)
        return
      }
      game.broadcastRoom(data.code, io)
      break
    }

    case 'ready': {
      const room = store.findRoomBySocket(socket.id)
      if (!room) {
        socket.emit('message', {
          type: 'error',
          message: '不在房间中',
        } as ServerMessage)
        return
      }
      const err = store.setReady(room.code, socket.id)
      if (err) {
        socket.emit('message', {
          type: 'error',
          message: err,
        } as ServerMessage)
        return
      }
      game.broadcastRoom(room.code, io)
      break
    }

    case 'start': {
      const room = store.findRoomBySocket(socket.id)
      if (!room) {
        socket.emit('message', {
          type: 'error',
          message: '不在房间中',
        } as ServerMessage)
        return
      }
      const err = store.startGame(room.code, socket.id)
      if (err) {
        socket.emit('message', {
          type: 'error',
          message: err,
        } as ServerMessage)
        return
      }
      game.launchGame(room.code, io)
      break
    }

    case 'action': {
      const err = game.applyAction(socket.id, data.action, io)
      if (err) {
        socket.emit('message', {
          type: 'error',
          message: err,
        } as ServerMessage)
        return
      }
      break
    }
  }
}
