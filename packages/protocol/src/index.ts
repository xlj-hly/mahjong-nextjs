// @mahjong/protocol 公开入口：网络协议消息类型 + NetworkRunner 客户端封装。

export { createNetworkRunner } from './network-runner'

export type { ConnectionState, NetworkRunner } from './network-runner'
export type {
  ActionMessage,
  ClientMessage,
  CreateRoomMessage,
  ErrorMessage,
  GameOverMessage,
  JoinRoomMessage,
  ReadyMessage,
  RoomMember,
  RoomMessage,
  ServerMessage,
  SnapshotMessage,
  StartMessage,
} from './protocol'
