// 房间管理：创建/加入/座位分配/准备状态/房主开局校验。

import type { RoomMember } from '@mahjong/protocol'

export interface Room {
  code: string
  rule: string
  hostId: string
  members: Map<string, { seat: number; ready: boolean }>
  started: boolean
}

const rooms = new Map<string, Room>()
const SEAT_COUNT = 4

/** 生成 6 位大写字母+数字房间码。 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** 创建房间，返回房间码。 */
export function createRoom(socketId: string, rule: string): string {
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
}

/** 加入房间。返回错误信息或 null（成功）。 */
export function joinRoom(code: string, socketId: string): string | null {
  const room = rooms.get(code)
  if (!room) return '房间不存在'
  if (room.started) return '对局已开始'
  if (room.members.has(socketId)) return '已在房间中'
  if (room.members.size >= SEAT_COUNT) return '房间已满'
  const seat = room.members.size
  room.members.set(socketId, { seat, ready: false })
  return null
}

/** 玩家准备。返回错误信息或 null。 */
export function setReady(code: string, socketId: string): string | null {
  const room = rooms.get(code)
  if (!room) return '房间不存在'
  if (room.started) return '对局已开始'
  const member = room.members.get(socketId)
  if (!member) return '不在房间中'
  member.ready = true
  return null
}

/** 房主开局。返回错误信息或 null。 */
export function startGame(code: string, socketId: string): string | null {
  const room = rooms.get(code)
  if (!room) return '房间不存在'
  if (room.started) return '对局已开始'
  if (room.hostId !== socketId) return '只有房主可以开局'
  if (room.members.size < SEAT_COUNT) return '人数不足'
  const allReady = [...room.members.values()].every((m) => m.ready)
  if (!allReady) return '有玩家未准备'
  room.started = true
  return null
}

/** 获取房间成员列表。 */
export function getRoomMembers(code: string): RoomMember[] {
  const room = rooms.get(code)
  if (!room) return []
  return [...room.members.entries()].map(([, m]) => ({
    seat: m.seat,
    ready: m.ready,
  }))
}

/** 获取房间信息。 */
export function getRoom(code: string): Room | undefined {
  return rooms.get(code)
}

/** 根据 socketId 查找所在房间。 */
export function findRoomBySocket(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.members.has(socketId)) return room
  }
  return undefined
}

/** 获取 socketId 在房间中的座位号。 */
export function getSeat(code: string, socketId: string): number | null {
  const room = rooms.get(code)
  if (!room) return null
  return room.members.get(socketId)?.seat ?? null
}

/** 删除房间。 */
export function deleteRoom(code: string): void {
  rooms.delete(code)
}

/** 重置（测试用）。 */
export function resetRooms(): void {
  rooms.clear()
}
