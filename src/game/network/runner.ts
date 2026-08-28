// NetworkRunner：客户端 socket 封装，暴露与本地 Runner 相同的 snapshot/apply 接口。
// 内部通过 socket 通信，对 UI 层透明。

import { io, type Socket } from 'socket.io-client'
import type { Action, Snapshot } from '../core/state-machine'
import type { Seat } from '../core/rules-plugin'
import type { ClientMessage, ServerMessage, RoomMember } from './protocol'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface NetworkRunner {
  /** 当前快照（从服务端最近一次广播）。 */
  snapshot: Snapshot | null
  /** 当前座位号。 */
  seat: Seat | null
  /** 房间码。 */
  roomCode: string | null
  /** 房间成员。 */
  members: RoomMember[]
  /** 当前规则。 */
  rule: string
  /** 对局是否已开始。 */
  started: boolean
  /** 对局是否已结束。 */
  isOver: boolean
  /** 连接状态。 */
  connectionState: ConnectionState
  /** 错误信息。 */
  error: string | null

  /** 创建房间。 */
  createRoom(rule: string): void
  /** 加入房间。 */
  joinRoom(code: string): void
  /** 准备。 */
  ready(): void
  /** 房主开局。 */
  start(): void
  /** 上报意图。 */
  apply(action: Action): void

  /** 注册状态变更回调。 */
  onUpdate(listener: () => void): () => void
  /** 断开连接。 */
  disconnect(): void
}

export function createNetworkRunner(serverUrl: string): NetworkRunner {
  let socket: Socket | null = null
  let snapshot: Snapshot | null = null
  let seat: Seat | null = null
  let roomCode: string | null = null
  let members: RoomMember[] = []
  let rule = 'guobiao'
  let started = false
  let isOver = false
  let connectionState: ConnectionState = 'disconnected'
  let error: string | null = null
  const listeners = new Set<() => void>()

  function notify() {
    for (const fn of listeners) fn()
  }

  function handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'room':
        roomCode = msg.code
        members = msg.members
        rule = msg.rule
        started = msg.started
        seat = msg.yourSeat as Seat
        error = null
        break
      case 'snapshot':
        snapshot = msg.snapshot
        seat = msg.snapshot.seat
        isOver = msg.snapshot.phase === 'ended'
        error = null
        break
      case 'gameOver':
        snapshot = msg.snapshot
        isOver = true
        error = null
        break
      case 'error':
        error = msg.message
        break
    }
    notify()
  }

  function ensureConnected() {
    if (socket?.connected) return
    socket = io(serverUrl, { transports: ['websocket'] })
    connectionState = 'connecting'
    notify()

    socket.on('connect', () => {
      connectionState = 'connected'
      notify()
    })

    socket.on('disconnect', () => {
      connectionState = 'disconnected'
      notify()
    })

    socket.on('message', handleMessage)
  }

  function send(msg: ClientMessage) {
    ensureConnected()
    socket?.emit('message', msg)
  }

  return {
    get snapshot() {
      return snapshot
    },
    get seat() {
      return seat
    },
    get roomCode() {
      return roomCode
    },
    get members() {
      return members
    },
    get rule() {
      return rule
    },
    get started() {
      return started
    },
    get isOver() {
      return isOver
    },
    get connectionState() {
      return connectionState
    },
    get error() {
      return error
    },

    createRoom(rule: string) {
      send({ type: 'create', rule: rule as 'guobiao' | 'sichuan' })
    },
    joinRoom(code: string) {
      send({ type: 'join', code })
    },
    ready() {
      send({ type: 'ready' })
    },
    start() {
      send({ type: 'start' })
    },
    apply(action: Action) {
      send({ type: 'action', action })
    },

    onUpdate(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    disconnect() {
      socket?.disconnect()
      socket = null
    },
  }
}
