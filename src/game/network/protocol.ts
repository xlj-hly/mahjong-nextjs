// 网络协议类型定义：客户端↔服务端消息格式。
// 直接映射引擎的 snapshot/apply 两个口子，不承载规则语义。

import type { Action, Snapshot } from '../core/state-machine'

// —— 客户端 → 服务端 ——

export interface CreateRoomMessage {
  type: 'create'
  rule: 'guobiao' | 'sichuan'
}

export interface JoinRoomMessage {
  type: 'join'
  code: string
}

export interface ReadyMessage {
  type: 'ready'
}

export interface StartMessage {
  type: 'start'
}

export interface ActionMessage {
  type: 'action'
  action: Action
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | ReadyMessage
  | StartMessage
  | ActionMessage

// —— 服务端 → 客户端 ——

export interface RoomMember {
  seat: number
  ready: boolean
}

export interface RoomMessage {
  type: 'room'
  code: string
  members: RoomMember[]
  rule: string
  started: boolean
  yourSeat: number
}

export interface SnapshotMessage {
  type: 'snapshot'
  snapshot: Snapshot
}

export interface GameOverMessage {
  type: 'gameOver'
  snapshot: Snapshot
}

export interface ErrorMessage {
  type: 'error'
  message: string
}

export type ServerMessage =
  | RoomMessage
  | SnapshotMessage
  | GameOverMessage
  | ErrorMessage
