// 房间存储：创建/加入/座位分配/准备状态/房主开局校验/离开清理。

import type { RoomMember, RuleId } from '@mahjong/protocol'
import type { Seat } from '@mahjong/game-core'

export interface Room {
  code: string
  rule: RuleId
  hostId: string
  members: Map<string, { seat: Seat; ready: boolean }>
  started: boolean
}

export interface RoomStore {
  createRoom(socketId: string, rule: RuleId): string
  joinRoom(code: string, socketId: string): string | null
  setReady(code: string, socketId: string): string | null
  startGame(code: string, socketId: string): string | null
  leaveRoom(code: string, socketId: string): void
  getRoomMembers(code: string): RoomMember[]
  getRoom(code: string): Room | undefined
  findRoomBySocket(socketId: string): Room | undefined
  getSeat(code: string, socketId: string): Seat | null
  deleteRoom(code: string): void
}

const SEAT_COUNT = 4

/** 生成 6 位大写字母+数字房间码（排除易混淆字符）。 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** 创建内存房间存储（每个实例持有独立的 rooms 表）。 */
export function createRoomStore(): RoomStore {
  const rooms = new Map<string, Room>()

  return {
    createRoom(socketId, rule) {
      let code = generateCode()
      while (rooms.has(code)) code = generateCode()
      const room: Room = {
        code,
        rule,
        hostId: socketId,
        members: new Map([[socketId, { seat: 0, ready: false }]]),
        started: false,
      }
      rooms.set(code, room)
      return code
    },

    joinRoom(code, socketId) {
      const room = rooms.get(code)
      if (!room) return '房间不存在'
      if (room.started) return '对局已开始'
      if (room.members.has(socketId)) return '已在房间中'
      if (room.members.size >= SEAT_COUNT) return '房间已满'
      const seat = room.members.size as Seat
      room.members.set(socketId, { seat, ready: false })
      return null
    },

    setReady(code, socketId) {
      const room = rooms.get(code)
      if (!room) return '房间不存在'
      if (room.started) return '对局已开始'
      const member = room.members.get(socketId)
      if (!member) return '不在房间中'
      member.ready = true
      return null
    },

    startGame(code, socketId) {
      const room = rooms.get(code)
      if (!room) return '房间不存在'
      if (room.started) return '对局已开始'
      if (room.hostId !== socketId) return '只有房主可以开局'
      if (room.members.size < SEAT_COUNT) return '人数不足'
      const allReady = [...room.members.values()].every((m) => m.ready)
      if (!allReady) return '有玩家未准备'
      room.started = true
      return null
    },

    leaveRoom(code, socketId) {
      const room = rooms.get(code)
      if (!room) return
      room.members.delete(socketId)
      // 开局前成员清空 → 自动删房（进行中对局不清理）
      if (!room.started && room.members.size === 0) {
        rooms.delete(code)
      }
    },

    getRoomMembers(code) {
      const room = rooms.get(code)
      if (!room) return []
      return [...room.members.entries()].map(([, m]) => ({
        seat: m.seat,
        ready: m.ready,
      }))
    },

    getRoom(code) {
      return rooms.get(code)
    },

    findRoomBySocket(socketId) {
      for (const room of rooms.values()) {
        if (room.members.has(socketId)) return room
      }
      return undefined
    },

    getSeat(code, socketId) {
      const room = rooms.get(code)
      if (!room) return null
      return room.members.get(socketId)?.seat ?? null
    },

    deleteRoom(code) {
      rooms.delete(code)
    },
  }
}
