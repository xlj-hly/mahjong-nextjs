// @mahjong/protocol 公开入口：客户端↔服务端网络协议消息类型（纯类型，无运行时）。

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
  RuleId,
  ServerMessage,
  SnapshotMessage,
  StartMessage,
} from './protocol'
