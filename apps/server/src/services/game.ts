// 对局编排：开局创建引擎、意图驱动引擎、快照/结算广播。持有 runners（引擎实例）。
// runners 实例级：闭包在 createGameService 内，与 store 同生命周期，避免跨 createApp 实例共享。

import type { Server } from 'socket.io'
import {
  createRunner,
  guobiao,
  sichuan,
  type Action,
  type Runner,
  type RulesPlugin,
} from '@mahjong/game-core'
import type { ServerMessage } from '@mahjong/protocol'
import type { RoomStore } from '../store/room-store'

const RULES: Record<string, RulesPlugin> = { guobiao, sichuan }

export interface GameService {
  /** 向房间内每位成员广播房间状态（每人的 yourSeat 各自独立）。 */
  broadcastRoom(code: string, io: Server): void
  /** 开局：创建引擎并广播房间态与初始快照（调用前须已通过 store.startGame 校验）。 */
  launchGame(code: string, io: Server): void
  /** 驱动意图：推进引擎并广播结果。返回错误信息或 null（成功）。 */
  applyAction(socketId: string, action: Action, io: Server): string | null
}

export function createGameService(store: RoomStore): GameService {
  // 房间码 → 对局引擎实例（实例级，随 app 生灭）
  const runners = new Map<string, Runner>()

  function broadcastRoom(code: string, io: Server): void {
    const room = store.getRoom(code)
    if (!room) return
    const members = store.getRoomMembers(code)
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
    const room = store.getRoom(code)
    if (!room) return
    for (const [socketId, member] of room.members) {
      const snapshot = runner.snapshot(member.seat)
      const msg: ServerMessage = { type: 'snapshot', snapshot }
      io.to(socketId).emit('message', msg)
    }
  }

  function broadcastGameOver(code: string, io: Server): void {
    const runner = runners.get(code)
    if (!runner) return
    const room = store.getRoom(code)
    if (!room) return
    for (const [socketId, member] of room.members) {
      const snapshot = runner.snapshot(member.seat)
      const msg: ServerMessage = { type: 'gameOver', snapshot }
      io.to(socketId).emit('message', msg)
    }
    // 对局结束：释放引擎 + 删除房间
    runners.delete(code)
    store.deleteRoom(code)
  }

  function launchGame(code: string, io: Server): void {
    const room = store.getRoom(code)
    if (!room) return
    const plugin = RULES[room.rule] ?? guobiao
    runners.set(code, createRunner(plugin))
    broadcastRoom(code, io)
    broadcastSnapshots(code, io)
  }

  function applyAction(
    socketId: string,
    action: Action,
    io: Server,
  ): string | null {
    const room = store.findRoomBySocket(socketId)
    if (!room || !room.started) return '对局未开始'
    const runner = runners.get(room.code)
    if (!runner) return '对局引擎未初始化'
    const seat = store.getSeat(room.code, socketId)
    if (seat === null) return '座位信息错误'
    try {
      runner.apply(seat, action)
    } catch (err) {
      return err instanceof Error ? err.message : '非法操作'
    }
    if (runner.isOver()) {
      broadcastGameOver(room.code, io)
    } else {
      broadcastSnapshots(room.code, io)
    }
    return null
  }

  return { broadcastRoom, launchGame, applyAction }
}
