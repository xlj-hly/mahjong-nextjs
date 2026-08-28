import { describe, expect, it, beforeEach } from 'vitest'
import {
  createRoom,
  joinRoom,
  setReady,
  startGame,
  getRoomMembers,
  getRoom,
  findRoomBySocket,
  getSeat,
  resetRooms,
} from './room'

describe('房间管理', () => {
  beforeEach(() => {
    resetRooms()
  })

  it('创建房间返回 6 位房间码，创建者为座位 0', () => {
    const code = createRoom('host', 'guobiao')
    expect(code).toHaveLength(6)
    const members = getRoomMembers(code)
    expect(members).toHaveLength(1)
    expect(members[0].seat).toBe(0)
    expect(members[0].ready).toBe(false)
  })

  it('加入房间按顺序分配座位', () => {
    const code = createRoom('host', 'guobiao')
    joinRoom(code, 'p1')
    joinRoom(code, 'p2')
    joinRoom(code, 'p3')
    const members = getRoomMembers(code)
    expect(members).toHaveLength(4)
    expect(members.map((m) => m.seat)).toEqual([0, 1, 2, 3])
  })

  it('房间满 4 人后拒绝加入', () => {
    const code = createRoom('host', 'guobiao')
    joinRoom(code, 'p1')
    joinRoom(code, 'p2')
    joinRoom(code, 'p3')
    const err = joinRoom(code, 'p4')
    expect(err).toBe('房间已满')
  })

  it('加入不存在的房间返回错误', () => {
    expect(joinRoom('XXXXXX', 'p1')).toBe('房间不存在')
  })

  it('重复加入返回错误', () => {
    const code = createRoom('host', 'guobiao')
    expect(joinRoom(code, 'host')).toBe('已在房间中')
  })

  it('准备状态设置成功', () => {
    const code = createRoom('host', 'guobiao')
    setReady(code, 'host')
    const members = getRoomMembers(code)
    expect(members[0].ready).toBe(true)
  })

  it('非房主不可开局', () => {
    const code = createRoom('host', 'guobiao')
    joinRoom(code, 'p1')
    joinRoom(code, 'p2')
    joinRoom(code, 'p3')
    setReady(code, 'host')
    setReady(code, 'p1')
    setReady(code, 'p2')
    setReady(code, 'p3')
    expect(startGame(code, 'p1')).toBe('只有房主可以开局')
  })

  it('未全员准备不可开局', () => {
    const code = createRoom('host', 'guobiao')
    joinRoom(code, 'p1')
    joinRoom(code, 'p2')
    joinRoom(code, 'p3')
    expect(startGame(code, 'host')).toBe('有玩家未准备')
  })

  it('全员准备后房主可开局', () => {
    const code = createRoom('host', 'guobiao')
    joinRoom(code, 'p1')
    joinRoom(code, 'p2')
    joinRoom(code, 'p3')
    setReady(code, 'host')
    setReady(code, 'p1')
    setReady(code, 'p2')
    setReady(code, 'p3')
    expect(startGame(code, 'host')).toBeNull()
    expect(getRoom(code)?.started).toBe(true)
  })

  it('对局已开始后不可加入', () => {
    const code = createRoom('host', 'guobiao')
    joinRoom(code, 'p1')
    joinRoom(code, 'p2')
    joinRoom(code, 'p3')
    setReady(code, 'host')
    setReady(code, 'p1')
    setReady(code, 'p2')
    setReady(code, 'p3')
    startGame(code, 'host')
    expect(joinRoom(code, 'p4')).toBe('对局已开始')
  })

  it('根据 socketId 查找房间', () => {
    const code = createRoom('host', 'guobiao')
    expect(findRoomBySocket('host')?.code).toBe(code)
    expect(findRoomBySocket('nobody')).toBeUndefined()
  })

  it('获取座位号', () => {
    const code = createRoom('host', 'guobiao')
    joinRoom(code, 'p1')
    expect(getSeat(code, 'host')).toBe(0)
    expect(getSeat(code, 'p1')).toBe(1)
    expect(getSeat(code, 'nobody')).toBeNull()
  })
})
